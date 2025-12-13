(() => {
    'use strict';

    const log = (...args) => {
        if (window.console && typeof window.console.log === 'function')
            console.log('[TextMap Test]', ...args);
    };

    const dumpTextMap = () => {
        const map = window.__cw_textMap || {};
        log('TextMap keys:', Object.keys(map).length);
        console.table(map);
    };

    const collectTexts = () => {
        if (!document.body)
            return [];
        const list = [];
        let counter = 0;
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
            acceptNode: node => (node.nodeValue || '').trim().length > 0 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP
        });
        let node;
        while (node = walker.nextNode()) {
            const el = node.parentElement;
            if (!el)
                continue;
            const rect = el.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0)
                continue;
            list.push({
                idx: ++counter,
                text: (node.nodeValue || '').trim(),
                tag: el.tagName,
                tail: (() => {
                    try {
                        let current = el;
                        const parts = [];
                        while (current && current.nodeType === 1 && parts.length < 8) {
                            let name = current.tagName.toLowerCase();
                            const cls = (current.className || '').toString().trim().split(/\s+/).filter(Boolean).slice(0, 2);
                            if (cls.length)
                                name += '.' + cls.join('.');
                            let idx = 1;
                            let prev = current.previousElementSibling;
                            while (prev) {
                                if (prev.tagName === current.tagName)
                                    idx++;
                                prev = prev.previousElementSibling;
                            }
                            parts.unshift(`${name}[${idx}]`);
                            current = current.parentElement;
                        }
                        return parts.join('/');
                    } catch (_) {
                        return '';
                    }
                })()
            });
        }
        return list;
    };

    const showTopTexts = (limit = 30) => {
        const texts = collectTexts();
        log(`Collected ${texts.length} text entries (top ${limit}):`);
        console.table(texts.slice(0, limit));
        return texts;
    };

    log('Running TextMap test. TextMap hook ready?', !!window.__cw_textMap);
    dumpTextMap();
    showTopTexts(50);
})();
