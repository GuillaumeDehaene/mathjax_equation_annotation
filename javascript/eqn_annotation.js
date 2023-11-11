/* Removes the links from all mathjax-processed \ref and \eqref.
 *
 * Normally, when MathJax processes a \ref or \eqref, it produces a
 * hyper-link towards the target equation.
 * It does so by inserting a <a> element with href="#id".
 * This function filters the document
 * finds all "mjx-mrow.MathJax_ref"
 * removes the <a> element and the tabindex property.
 * 
*/
function remove_ref_links() {
    for (const mrow_elem of document.querySelectorAll("mjx-mrow.MathJax_ref")) {
        const a_elem = mrow_elem.parentElement
        if (a_elem.tagName=="A") {
            const mjx_math_elem = a_elem.parentElement
            mjx_math_elem.removeChild(a_elem)
            mjx_math_elem.appendChild(mrow_elem)
        }
        const container = mrow_elem.parentElement.parentElement;
        container.removeAttribute("tabindex");
    }
}

/* Analyze a single MathJax MathML block, from any of its DOM elements.
 * 
 * Given a single starting MathML DOM element, compute an analysis
 * of its components:
 * - Key DOM elements
 * - Number of lines
 * - Number of equations
*/
function analyze_mathjax_formatted_equation(dom_element) {
    // Find the root
    root = dom_element;
    while (root.tagName != "MJX-CONTAINER") {
        root = root.parentElement;
    }
    span_container = root.parentElement;

    // From the root, identify other key elements
    assistive_root = root.children[1];
    content_root = root.children[0];

    
    // labelled equation or multiline unlabelled
    if (content_root.children[0].tagName == "MJX-MTABLE") {
        math_root = content_root.children[0].children[0];
        
        math_lines_container = math_root.children[0];
        math_lines_elems = math_lines_container.children;
        
        // The number of math content lines in the document
        num_lines = math_lines_elems.length;
        
        labels_root = content_root.querySelector("mjx-labels");

        if (labels_root) {
            labels_lines_container = labels_root.children[0];
            labels_lines_elems = labels_lines_container.children;
            
            // The elements bearings the #IDs
            anchors = labels_lines_container.querySelectorAll("mjx-mtd");
            
            ids = [];
            for (elem of anchors) {
                ids.push(elem.id);
            }
    
            // The number of tags / equation numbers
            num_eqn_tags = ids.length;
    
            // Array[Array[int]] mapping equation index to lines indices
            // Assume that the final line of each eqn is labelled
            // e.g. if we have 4 lines with:
            // - eqn 1 on line 1
            // - eqn 2 on line 2-3
            // - eqn 3 on line 3
            // eqn_to_line_map = [[0], [1, 2], [3]];
            eqn_idx = 0;
            eqn_to_line_map = [];
            current_eqn = [];
            for ([line_idx, line_elem] of Array.from(math_lines_elems).entries()) {
                current_eqn.push(line_idx);
                if (line_elem.tagName == "MJX-MLABELEDTR") {
                    eqn_to_line_map.push(current_eqn);
                    current_eqn = [];
                    eqn_idx += 1;
                }
            }
            // flush if the equation didn't finish with a labelled line
            if (current_eqn.length > 0) {
                eqn_to_line_map.push(current_eqn);
            }
            num_eqn = eqn_to_line_map.length;
    
            dom_elements = {
                "span_container": span_container,
                "root": root,
                "assistive_root": assistive_root,
                "content_root": content_root,
                "math_root": math_root,
                "math_lines_container": math_lines_container,
                "math_lines_elems": math_lines_elems,
                "labels_root": labels_root,
                "labels_lines_container": labels_lines_container,
                "labels_lines_elems": labels_lines_elems,
                "anchors": anchors,
                "eqn_to_line_map": eqn_to_line_map,
            }
        
            info = {
                "ids": ids,
                "num_lines": num_lines,
                "num_eqn_tags": num_eqn_tags,
                "num_eqn": num_eqn,
                "eqn_to_line_map": eqn_to_line_map,
            }
    
            return {
                "dom_elements": dom_elements,
                "info": info,
            }
        }
        dom_elements = {
            "span_container": span_container,
            "root": root,
            "assistive_root": assistive_root,
            "content_root": content_root,
            "math_root": math_root,
            "math_lines_container": math_lines_container,
            "math_lines_elems": math_lines_elems,
        }
    
        info = {
            "num_lines": num_lines,
            "num_eqn_tags": 0,
        }

        return {
            "dom_elements": dom_elements,
            "info": info,
        }
    };

    // singe line unlabelled equation
    dom_elements = {
        "span_container": span_container,
        "root": root,
        "assistive_root": assistive_root,
        "content_root": content_root,
    }

    info = {
        "num_lines": 1,
        "num_eqn_tags": 0,
    }

    return {
        "dom_elements": dom_elements,
        "info": info,
    }
}

/* Return a div highlighting a group of MathJax equations.
 * 
 * Given a list of targets IDs identifying MathJax equations:
 * - Find the corresponding equation block
 * - Check that all IDs are from this equation block
 * - Find the region delimited by the math
 * - Return a highlighting div
 *   The div is decorated with the method _adjust_top_bottom
 *   which re-adjusts its size to the corresponding equation
 * 
 * Throws an Error:
 * - when the first ID is not found
 * - when IDs correspond to multiple equation blocks.
*/
function compute_mjx_highlight_div(target_ids) {
    const div_id = `div-${target_ids.join("-")}`;
    const pre_existing = document.querySelector("#" + div_id);
    if (pre_existing) {
        return pre_existing
    }

    // Find the root
    var root = document.querySelector(`#${target_ids[0].replace("%3A", "\\:")}`);
    if (root === null) {
        throw new Error(`Failed to find ID: ${target_ids[0]}`)
    }
    while (root.tagName != "MJX-CONTAINER") {
        root = root.parentElement;
    }
    const content_root = root.children[0];

    const math_root = content_root.children[0].children[0];
    const math_lines_elems = math_root.children[0].children;
    
    const labels_root = content_root.querySelector("mjx-labels");
    
    const eqn_ids = [];
    for (elem of labels_root.querySelectorAll("mjx-mtd")) {
        eqn_ids.push(elem.id);
    }

    // Array[Array[int]] mapping equation index to lines indices
    // Assume that the final line of each eqn is labelled
    // e.g. if we have 4 lines with:
    // - eqn 1 on line 1
    // - eqn 2 on line 2-3
    // - eqn 3 on line 3
    // eqn_to_line_map = [[0], [1, 2], [3]];
    var eqn_idx = 0;
    const eqn_to_line_map = [];
    var current_eqn = [];
    let line_idx, line_elem;
    for ([line_idx, line_elem] of Array.from(math_lines_elems).entries()) {
        current_eqn.push(line_idx);
        if (line_elem.tagName == "MJX-MLABELEDTR") {
            eqn_to_line_map.push(current_eqn);
            current_eqn = [];
            eqn_idx += 1;
        }
    }
    // flush if the equation didn't finish with a labelled line
    if (current_eqn.length > 0) {
        eqn_to_line_map.push(current_eqn);
        console.log("Equations should all be numbered but this one isn't:", line_elem)
    }
    
    let line_indices = [];
    for (const target_id of target_ids) {
        const target_id_index = eqn_ids.indexOf(target_id);
        if (target_id_index == -1) {
            throw new Error(`Missing target id: ${target_id} in ${eqn_ids}`)
        }
        line_indices = line_indices.concat(eqn_to_line_map[target_id_index]);
    }

    div = document.createElement("div");
    div.id = div_id;
    div.classList.add("mjx_eqn_highlight");
    root.appendChild(div);

    let adjust_top_bottom = function() {
        var top = Infinity;
        var bottom = -Infinity;
        for (line_idx of line_indices) {
            line_elem = math_lines_elems[line_idx];
            top = Math.min(top, line_elem.offsetTop);
            bottom = Math.max(bottom, line_elem.offsetTop + line_elem.offsetHeight);
        }
        const height = bottom - top;

        div.style.setProperty("--top-ref", top + "px");
        div.style.setProperty("--height-ref", height + "px");
    }

    adjust_top_bottom();
    div._adjust_top_bottom = adjust_top_bottom;

    return div
}


/* Analyze equation annotations
 * 
 * This function assumes that it is applied to dl element of class "mathjax-code-annotation"
 * dt elements should specify which equation IDs they apply to
 * with data-key `targettedIds` (targetted-ids in source HTML)
 * IDs are encoded as a `;` separated list
 * 
*/
function analyze_eqn_annotation(dl_element, style="bottom") {
    // Hide dl if in "side" mode
    if (style == "side") {
        dl_element.style.display = "none";
    }

    for (const dt_elem of dl_element.querySelectorAll("dt")) {
        console.log(dt_elem);
        const raw_ids = dt_elem.dataset.annotationTargetIds.split(";");
        const ids = [];
        for (const id of raw_ids) {
            ids.push(`mjx-eqn-${id}`)
        }
        const div = compute_mjx_highlight_div(ids);

        const trigger_target = [];
        let content;
        let attach_to;
        if (style == "bottom") {
            trigger_target.push(dt_elem);
            content = null;
            attach_to = dt_elem;
        } else if (style == "side") {
            for (id of ids) {
                trigger_target.push(document.querySelector(`#${id}`));
            }
            console.log(dt_elem.nextElementSibling);
            content = dt_elem.nextElementSibling.innerHTML;
            attach_to = div;
        }

        for (const trigger_elem of trigger_target) {
            trigger_elem.classList.add("mathjax-code-annotation-trigger");
            trigger_elem.setAttribute("tabindex", "0");
        }
        console.log(trigger_target);

        const config = {
            allowHTML: true,
            content: content,
            onShow: (instance) => {
                window.tippy.hideAll();
                div._adjust_top_bottom();
                div.setAttribute("data-status", "active");
            },
            onHide: (instance) => {
                div.removeAttribute("data-status");
            },
            maxWidth: 300,
            delay: [50, 0],
            duration: [200, 0],
            offset: [5, 10],
            arrow: true,
            trigger: 'click mouseenter focus',
            triggerTarget: trigger_target,
            appendTo: function(el) {
              return attach_to
            },
            interactive: true,
            interactiveBorder: 10,
            theme: 'quarto',
            placement: 'right',
            positionFixed: true,
            popperOptions: {
              modifiers: [
              {
                name: 'flip',
                options: {
                  flipVariations: false, // true by default
                  allowedAutoPlacements: ['right'],
                  fallbackPlacements: ['right', 'top-end', 'top-start', 'top'],
                },
              },
              {
                name: 'preventOverflow',
                options: {
                  mainAxis: false,
                  altAxis: false
                }
              }
              ]        
            }      
        };
        const tippy = window.tippy(attach_to, config);

        // for style == "bottom", make tooltip invisible
        if (style == "bottom") {
            tippy.popper.style.display = "none";
        }
    }
}

/* Write a simple analysis report for a test document.
*/
function analysis_report() {
    mathjax_roots = document.querySelectorAll("mjx-container");

    console.log("Found mathjax roots: ", mathjax_roots.length);

    for ([idx, elem] of mathjax_roots.entries()) {
        root_elem = mathjax_roots[idx];
        res = analyze_mathjax_formatted_equation(root_elem);

        console.log("")
        console.log("Analyzed root: ", idx);
        console.log(res["info"]);
        console.log(res["info"]["eqn_to_line_map"])
        console.log(res["dom_elements"]["root"])
    }

    return res
}

window.addEventListener('DOMContentLoaded', (event) => {

    remove_ref_links();

    let style = "bottom";
    for (annotation_elem of document.querySelectorAll("dl.mathjax-code-annotation")) {
        analyze_eqn_annotation(annotation_elem, style);
        style = "side";
    }

})
