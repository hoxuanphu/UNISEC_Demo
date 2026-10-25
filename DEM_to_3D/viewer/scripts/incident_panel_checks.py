"""Check the overview's readable bounds and its grouped cards."""


def check_incident_layout(page):
    problems = page.locator('#response-panel').evaluate("""panel => {
        const errors = [], rect = node => node.getBoundingClientRect();
        const body = panel.querySelector('.incident-overview');
        const heading = panel.querySelector('h1');
        if (!body || !heading) return ['Missing incident overview'];
        if (panel.scrollWidth > panel.clientWidth + 1 || body.scrollWidth > body.clientWidth + 1)
            errors.push('incident panel overflow');
        // Title, figure tiles and group cards share one left edge.
        const left = rect(heading).left;
        panel.querySelectorAll('.incident-summary-fact:first-child, .incident-overview > *').forEach(node => {
            if (rect(node).width && Math.abs(rect(node).left - left) > 1) errors.push('inconsistent inset: ' + node.className);
        });
        body.querySelectorAll('.incident-landslide-row, .incident-work-row').forEach(row => {
            if (rect(row).width && rect(row).height < 40) errors.push('insufficient list row hit area');
        });
        // Each group is a card; its label stays sentence case.
        const groups = [...body.querySelectorAll(':scope > section')];
        groups.forEach(group => {
            if (!parseFloat(getComputedStyle(group).borderTopLeftRadius)) errors.push('group is not a card: ' + group.className);
            const label = group.querySelector('h2');
            if (label && getComputedStyle(label).textTransform === 'uppercase') errors.push('uppercase label: ' + label.textContent);
        });
        const children = [...body.children];
        for (let i = 1; i < children.length; i++) {
            const gap = rect(children[i]).top - rect(children[i - 1]).bottom;
            if (gap < 8) errors.push(`group gap ${gap}px: ${children[i - 1].className} / ${children[i].className}`);
        }
        return errors;
    }""")
    assert not problems, problems
