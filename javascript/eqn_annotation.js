/* Removes the links from all mathjax-processed \ref and \eqref.
 *
 * Normally, when MathJax processes a \ref or \eqref, it produces a
 * hyper-link towards the target equation.
 * It does so by inserting a <a> element with href="#id".
 * This function filters the document
 * finds all "mjx-mrow.MathJax_ref"
 * removes the <a> element and the tabindex property.
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
    let root = document.querySelector(`#${target_ids[0].replace("%3A", "\\:")}`);
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
    let eqn_idx = 0;
    const eqn_to_line_map = [];
    let current_eqn = [];
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

    const div = document.createElement("div");
    div.id = div_id;
    div.classList.add("mjx_eqn_highlight");
    root.appendChild(div);

    const adjust_top_bottom = function() {
        let top = Infinity;
        let bottom = -Infinity;
        for (const line_idx of line_indices) {
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


/* Render equation annotations encoded in a dl element
 * 
 * This function assumes that it is applied to dl element of class "mathjax-code-annotation"
 * dt elements should specify which equation IDs they apply to
 * with data-key `targettedIds` (targetted-ids in source HTML)
 * IDs should be encoded as a `;` separated list
*/
function render_eqn_annotation(dl_element, style="bottom") {
    // Hide dl if in "side" mode
    if (style == "side") {
        dl_element.style.display = "none";
    }

    for (const dt_elem of dl_element.querySelectorAll("dt")) {
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
            content = dt_elem.nextElementSibling.innerHTML;
            attach_to = div;
        }

        for (const trigger_elem of trigger_target) {
            trigger_elem.classList.add("mathjax-code-annotation-trigger");
            trigger_elem.setAttribute("tabindex", "0");
        }

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
                  fallbackPlacements: ['right', 'top-end', 'bottom-end', 'top', 'bottom', 'left', 'top-start', 'bottom-start'],
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


// This function will trigger after MathJax is done rendering
// We insert it in the MathJax lifecycle via the MathJax configuration object
function after_mathjax_ready() {
    remove_ref_links();
    
    let style;

    // annotations pop-up on hovering equation numbers
    style = "side";

    // // annotations are a standard dd; hovering causes the highlight to appear
    // style = "bottom"

    for (annotation_elem of document.querySelectorAll("dl.mathjax-code-annotation")) {
        render_eqn_annotation(annotation_elem, style);
        
        // Demo snippet: alternate between bottom and side styles
        if (style == "bottom") {style = "side";}
        else {style = "bottom";}
    }
}

// MathJax configuration object
window.MathJax = {
    tex: {
        // number all equations in ams latex environments
        tags: 'ams',  // should be 'ams', 'none', or 'all'
        // Modify how MathJax generates ids: replace the `mjx-eqn:LABEL` with `mjx-eqn-LABEL` 
        tagformat: {
            number: (n) => n.toString(),
            tag:    (tag) => '(' + tag + ')',
            id:     (id) => 'mjx-eqn-' + id.replace(/\s/g, '_'),
            url:    (id, base) => base + '#' + encodeURIComponent(id),
        },
    },
    startup: {
        pageReady() {
            return MathJax.startup.defaultPageReady().then(
                function () {
                    after_mathjax_ready();
                }
            );
        }
    }
};
