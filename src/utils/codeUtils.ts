// Adds handle IDs to syntax-highlighted tokens for linking
export const activateSymbols = (editorElement: HTMLElement) => {
    const tokens = editorElement.querySelectorAll('.token');
    tokens.forEach((token: any, index) => {
        const name = token.innerText.trim();
        if (!name) return;
        // Skip punctuation tokens
        if (/^[\(\)\[\]\{\}:;,.\/\|\s\\!?"']+$/.test(name)) return;
        token.dataset.handleId = `token-${name}-${index}`;
    });
};

// Adds interactive handles to plain text/code words
export const addGenericHandlesToCode = (editorElement: HTMLElement) => {
    const walker = document.createTreeWalker(editorElement, NodeFilter.SHOW_TEXT, null);
    const nodesToReplace: Text[] = [];
    let textNode;

    while (textNode = walker.nextNode() as Text) {
        if (!textNode.parentElement?.closest('[data-handle-id]') && textNode.textContent?.trim()) {
            nodesToReplace.push(textNode);
        }
    }

    const tokenRegex = /(https?:\/\/[^\s\(\)\[\]\{\}:;,"'<>]+)|([\(\)\[\]\{\}:;,.\/\|\s\\!?"']+)|([^\(\)\[\]\{\}:;,.\/\|\s\\!?"']+)/gi;

    nodesToReplace.forEach((textNode, textNodeIndex) => {
        const content = textNode.textContent || '';
        const container = document.createElement('span');
        let html = '';

        let match;
        tokenRegex.lastIndex = 0;
        let tokenIndex = 0;

        while ((match = tokenRegex.exec(content)) !== null) {
            const [_, url, sep, word] = match;
            if (url) {
                html += `<span class="word-handle" data-handle-id="url-${textNodeIndex}-${tokenIndex}">${url}</span>`;
            } else if (sep) {
                html += sep;
            } else if (word) {
                html += `<span class="word-handle" data-handle-id="word-${word}-${textNodeIndex}-${tokenIndex}">${word}</span>`;
            }
            tokenIndex++;
        }

        if (html) {
            container.innerHTML = html;
            const fragment = document.createDocumentFragment();
            while (container.firstChild) {
                fragment.appendChild(container.firstChild);
            }
            textNode.replaceWith(fragment);
        }
    });
};
