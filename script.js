const colors = [
    '#3b82f6', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6',
    '#ef4444', '#06b6d4', '#84cc16', '#f97316', '#a855f7'
];

// デフォルトの人物は loadFromLocalStorage で初期化
let people = [];

// デフォルトの関係性も loadFromLocalStorage で初期化
let relationships = [];

let dragging = null;
let draggingLabel = null;
let selectedColor = '#3b82f6';
let canvas, ctx;
let canvasWidth = 800;
let canvasHeight = 500;
const imageCache = {};
let scale = 1.0;
let minScale = 0.5;
let maxScale = 3.0;
let offsetX = 0;
let offsetY = 0;
let lastTouchDistance = 0;
let addRelationMode = false;
let relationFrom = null;
let relationTo = null;

window.onload = function() {
    canvas = document.getElementById('canvas');
    ctx = canvas.getContext('2d');

    canvas.addEventListener('mousedown', handleCanvasMouseDown);
    canvas.addEventListener('mousemove', handleCanvasMouseMove);
    canvas.addEventListener('mouseup', handleCanvasMouseUp);
    canvas.addEventListener('mouseleave', handleCanvasMouseUp);

    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);
    canvas.addEventListener('touchcancel', handleTouchEnd);

    canvas.addEventListener('wheel', handleWheel, { passive: false });

    // キーボードイベント
    document.addEventListener('keydown', handleKeyDown);

    document.getElementById('addPersonBtn').addEventListener('click', showAddPersonForm);
    document.getElementById('addPersonSubmit').addEventListener('click', addPerson);
    document.getElementById('addPersonCancel').addEventListener('click', cancelAddPerson);

    document.getElementById('addRelationBtn').addEventListener('click', showAddRelationForm);
    document.getElementById('addRelationSubmit').addEventListener('click', addRelation);
    document.getElementById('addRelationCancel').addEventListener('click', cancelAddRelation);

    document.getElementById('autoArrangeBtn').addEventListener('click', autoArrange);
    document.getElementById('saveImageBtn').addEventListener('click', saveAsImage);

    document.getElementById('shareTwitterBtn').addEventListener('click', shareTwitter);
    document.getElementById('shareLineBtn').addEventListener('click', shareLine);
    document.getElementById('moreShareBtn').addEventListener('click', openShareModal);
    document.getElementById('closeShareModal').addEventListener('click', closeShareModal);
    document.getElementById('shareFacebookBtn').addEventListener('click', shareFacebook);
    document.getElementById('shareInstagramBtn').addEventListener('click', shareInstagram);
    document.getElementById('shareRedditBtn').addEventListener('click', shareReddit);
    document.getElementById('sharePinterestBtn').addEventListener('click', sharePinterest);
    document.getElementById('copyLinkBtn2').addEventListener('click', copyLink);

    // Close modal on outside click
    document.getElementById('shareModal').addEventListener('click', function(e) {
        if (e.target.id === 'shareModal') {
            closeShareModal();
        }
    });

    document.getElementById('zoomInBtn').addEventListener('click', zoomIn);
    document.getElementById('zoomOutBtn').addEventListener('click', zoomOut);
    document.getElementById('resetZoomBtn').addEventListener('click', resetZoom);

    // Header navigation
    const menuBtn = document.getElementById('menuBtn');
    const mobileMenu = document.getElementById('mobileMenu');
    const closeMobileMenu = document.getElementById('closeMobileMenu');
    const contactLink = document.getElementById('contactLink');
    const mobileContactLink = document.getElementById('mobileContactLink');

    if (menuBtn) {
        menuBtn.addEventListener('click', () => {
            mobileMenu.style.display = 'block';
            setTimeout(() => mobileMenu.classList.add('open'), 10);
        });
    }

    if (closeMobileMenu) {
        closeMobileMenu.addEventListener('click', () => {
            mobileMenu.classList.remove('open');
            setTimeout(() => mobileMenu.style.display = 'none', 300);
        });
    }

    if (contactLink) {
        contactLink.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = 'mailto:contact@soukanzu.jp';
        });
    }

    if (mobileContactLink) {
        mobileContactLink.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = 'mailto:contact@soukanzu.jp';
        });
    }

    loadFromLocalStorage();
    renderColorPicker();
    resizeCanvas();
    render();
    updateOGPTags(); // Update OGP tags on page load

    window.addEventListener('resize', resizeCanvas);
};

function cancelAddRelationMode() {
    if (addRelationMode) {
        addRelationMode = false;
        relationFrom = null;
        relationTo = null;
        canvas.style.cursor = 'default';
        renderCanvas();
    }
}

function handleKeyDown(e) {
    // Escキーで関係性追加モードをキャンセル
    if (e.key === 'Escape') {
        cancelAddRelationMode();
    }
}

function resizeCanvas() {
    const container = canvas.parentElement;
    const containerWidth = container.clientWidth;

    canvasWidth = Math.min(containerWidth - 4, 800);
    canvasHeight = Math.floor(canvasWidth * 0.625);

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    render();
}

function renderColorPicker() {
    const picker = document.getElementById('colorPicker');
    picker.innerHTML = '';
    colors.forEach(color => {
        const div = document.createElement('div');
        div.className = 'color-option' + (color === selectedColor ? ' selected' : '');
        div.style.backgroundColor = color;
        div.onclick = () => {
            selectedColor = color;
            renderColorPicker();
        };
        picker.appendChild(div);
    });
}

function render() {
    renderPersonList();
    renderRelationList();
    renderCanvas();
}

function renderPersonList() {
    const list = document.getElementById('personList');
    list.innerHTML = '';

    people.forEach(person => {
        const div = document.createElement('div');
        div.className = 'person-item';

        const avatar = document.createElement('div');
        avatar.className = 'person-avatar';
        avatar.style.backgroundColor = person.color;

        if (person.image) {
            const img = document.createElement('img');
            img.src = person.image;
            avatar.appendChild(img);
        } else {
            avatar.textContent = person.name[0];
        }

        const uploadLabel = document.createElement('label');
        uploadLabel.className = 'upload-icon';
        uploadLabel.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#666" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
        `;
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.style.display = 'none';
        fileInput.addEventListener('change', (e) => handleImageUpload(person.id, e));
        uploadLabel.appendChild(fileInput);
        avatar.appendChild(uploadLabel);

        const info = document.createElement('div');
        info.className = 'person-info';
        const nameDiv = document.createElement('div');
        nameDiv.className = 'person-name';
        nameDiv.textContent = person.name;
        nameDiv.addEventListener('click', () => editPersonName(person.id));
        info.appendChild(nameDiv);

        const deleteBtn = document.createElement('div');
        deleteBtn.className = 'delete-btn';
        deleteBtn.innerHTML = `
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
        `;
        deleteBtn.addEventListener('click', () => deletePerson(person.id));

        div.appendChild(avatar);
        div.appendChild(info);
        div.appendChild(deleteBtn);
        list.appendChild(div);
    });
}

function renderRelationList() {
    const list = document.getElementById('relationList');
    list.innerHTML = '';

    relationships.forEach(rel => {
        const fromPerson = people.find(p => p.id === rel.from);
        const toPerson = people.find(p => p.id === rel.to);
        if (!fromPerson || !toPerson) return;

        const div = document.createElement('div');
        div.className = 'relation-item';

        const info = document.createElement('div');
        info.className = 'relation-info';

        const arrow = document.createElement('div');
        arrow.className = 'relation-arrow';
        arrow.innerHTML = `
            <span style="color: ${fromPerson.color}; font-weight: 600;">${fromPerson.name}</span>
            <span>→</span>
            <span style="color: ${toPerson.color}; font-weight: 600;">${toPerson.name}</span>
        `;

        const label = document.createElement('div');
        label.className = 'relation-label';
        label.textContent = rel.label;
        label.addEventListener('click', () => editRelationLabel(rel.id));

        info.appendChild(arrow);
        info.appendChild(label);

        const deleteBtn = document.createElement('div');
        deleteBtn.className = 'delete-btn';
        deleteBtn.innerHTML = `
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
        `;
        deleteBtn.addEventListener('click', () => deleteRelation(rel.id));

        div.appendChild(info);
        div.appendChild(deleteBtn);
        list.appendChild(div);
    });
}

function drawLabel(text, x, y, relationshipId) {
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const textMetrics = ctx.measureText(text);
    const textWidth = textMetrics.width;
    const padding = 6;

    const rectX = x - textWidth / 2 - padding;
    const rectY = y - 10;
    const rectWidth = textWidth + padding * 2;
    const rectHeight = 20;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fillRect(rectX, rectY, rectWidth, rectHeight);

    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    ctx.strokeRect(rectX, rectY, rectWidth, rectHeight);

    ctx.fillStyle = '#333';
    ctx.fillText(text, x, y);

    return {
        x: rectX,
        y: rectY,
        width: rectWidth,
        height: rectHeight,
        centerX: x,
        centerY: y,
        relationshipId: relationshipId
    };
}

const labelPositions = [];

function renderCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.scale(scale, scale);
    ctx.translate(offsetX, offsetY);

    labelPositions.length = 0;

    relationships.forEach(rel => {
        const fromPerson = people.find(p => p.id === rel.from);
        const toPerson = people.find(p => p.id === rel.to);
        if (!fromPerson || !toPerson) return;

        const reverseRel = relationships.find(r => r.from === rel.to && r.to === rel.from);
        const isBidirectional = !!reverseRel;

        const dx = toPerson.x - fromPerson.x;
        const dy = toPerson.y - fromPerson.y;
        const angle = Math.atan2(dy, dx);

        const avatarRadius = 35;
        const nameHeight = 20;
        const buffer = 10;

        const avoidanceDistance = avatarRadius + nameHeight + buffer;

        const arrowSize = 10;

        if (isBidirectional) {
            const lineOffset = 8;

            const perpAngle = angle + Math.PI / 2;

            const startX1 = fromPerson.x + Math.cos(angle) * avoidanceDistance + Math.cos(perpAngle) * lineOffset;
            const startY1 = fromPerson.y + Math.sin(angle) * avoidanceDistance + Math.sin(perpAngle) * lineOffset;
            const endX1 = toPerson.x - Math.cos(angle) * avoidanceDistance + Math.cos(perpAngle) * lineOffset;
            const endY1 = toPerson.y - Math.sin(angle) * avoidanceDistance + Math.sin(perpAngle) * lineOffset;

            ctx.beginPath();
            ctx.moveTo(startX1, startY1);
            ctx.lineTo(endX1, endY1);
            ctx.strokeStyle = '#666';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(endX1, endY1);
            ctx.lineTo(
                endX1 - arrowSize * Math.cos(angle - Math.PI / 6),
                endY1 - arrowSize * Math.sin(angle - Math.PI / 6)
            );
            ctx.lineTo(
                endX1 - arrowSize * Math.cos(angle + Math.PI / 6),
                endY1 - arrowSize * Math.sin(angle + Math.PI / 6)
            );
            ctx.closePath();
            ctx.fillStyle = '#666';
            ctx.fill();

            const startX2 = toPerson.x + Math.cos(angle + Math.PI) * avoidanceDistance - Math.cos(perpAngle) * lineOffset;
            const startY2 = toPerson.y + Math.sin(angle + Math.PI) * avoidanceDistance - Math.sin(perpAngle) * lineOffset;
            const endX2 = fromPerson.x - Math.cos(angle + Math.PI) * avoidanceDistance - Math.cos(perpAngle) * lineOffset;
            const endY2 = fromPerson.y - Math.sin(angle + Math.PI) * avoidanceDistance - Math.sin(perpAngle) * lineOffset;

            ctx.beginPath();
            ctx.moveTo(startX2, startY2);
            ctx.lineTo(endX2, endY2);
            ctx.strokeStyle = '#666';
            ctx.lineWidth = 2;
            ctx.stroke();

            const reverseAngle = angle + Math.PI;
            ctx.beginPath();
            ctx.moveTo(endX2, endY2);
            ctx.lineTo(
                endX2 - arrowSize * Math.cos(reverseAngle - Math.PI / 6),
                endY2 - arrowSize * Math.sin(reverseAngle - Math.PI / 6)
            );
            ctx.lineTo(
                endX2 - arrowSize * Math.cos(reverseAngle + Math.PI / 6),
                endY2 - arrowSize * Math.sin(reverseAngle + Math.PI / 6)
            );
            ctx.closePath();
            ctx.fillStyle = '#666';
            ctx.fill();
        } else {
            const startX = fromPerson.x + Math.cos(angle) * avoidanceDistance;
            const startY = fromPerson.y + Math.sin(angle) * avoidanceDistance;
            const endX = toPerson.x - Math.cos(angle) * avoidanceDistance;
            const endY = toPerson.y - Math.sin(angle) * avoidanceDistance;

            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.strokeStyle = '#666';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(endX, endY);
            ctx.lineTo(
                endX - arrowSize * Math.cos(angle - Math.PI / 6),
                endY - arrowSize * Math.sin(angle - Math.PI / 6)
            );
            ctx.lineTo(
                endX - arrowSize * Math.cos(angle + Math.PI / 6),
                endY - arrowSize * Math.sin(angle + Math.PI / 6)
            );
            ctx.closePath();
            ctx.fillStyle = '#666';
            ctx.fill();
        }

        const perpAngle = angle + Math.PI / 2;
        const startX = fromPerson.x + Math.cos(angle) * avoidanceDistance;
        const startY = fromPerson.y + Math.sin(angle) * avoidanceDistance;
        const endX = toPerson.x - Math.cos(angle) * avoidanceDistance;
        const endY = toPerson.y - Math.sin(angle) * avoidanceDistance;

        if (isBidirectional) {
            const lineOffset = 8;
            const labelOffset = 20;
            const positionRatio = 0.4;

            const midX1 = startX + (endX - startX) * positionRatio;
            const midY1 = startY + (endY - startY) * positionRatio;

            let labelX1 = midX1 + Math.cos(perpAngle) * (lineOffset + labelOffset);
            let labelY1 = midY1 + Math.sin(perpAngle) * (lineOffset + labelOffset);

            if (rel.labelOffsetX !== null && rel.labelOffsetY !== null) {
                labelX1 = rel.labelOffsetX;
                labelY1 = rel.labelOffsetY;
            }

            const labelInfo1 = drawLabel(rel.label, labelX1, labelY1, rel.id);
            labelPositions.push(labelInfo1);

            const midX2 = startX + (endX - startX) * (1 - positionRatio);
            const midY2 = startY + (endY - startY) * (1 - positionRatio);

            let labelX2 = midX2 - Math.cos(perpAngle) * (lineOffset + labelOffset);
            let labelY2 = midY2 - Math.sin(perpAngle) * (lineOffset + labelOffset);

            if (reverseRel.labelOffsetX !== null && reverseRel.labelOffsetY !== null) {
                labelX2 = reverseRel.labelOffsetX;
                labelY2 = reverseRel.labelOffsetY;
            }

            const labelInfo2 = drawLabel(reverseRel.label, labelX2, labelY2, reverseRel.id);
            labelPositions.push(labelInfo2);
        } else {
            const positionRatio = 0.4;
            const perpOffset = 25;
            let labelX = startX + (endX - startX) * positionRatio + Math.cos(perpAngle) * perpOffset;
            let labelY = startY + (endY - startY) * positionRatio + Math.sin(perpAngle) * perpOffset;

            if (rel.labelOffsetX !== null && rel.labelOffsetY !== null) {
                labelX = rel.labelOffsetX;
                labelY = rel.labelOffsetY;
            }

            const labelInfo = drawLabel(rel.label, labelX, labelY, rel.id);
            labelPositions.push(labelInfo);
        }
    });

    people.forEach(person => {
        ctx.beginPath();
        ctx.arc(person.x, person.y, 35, 0, Math.PI * 2);
        ctx.fillStyle = person.color;
        ctx.fill();

        // 選択状態の表示
        if (addRelationMode) {
            if (relationFrom === person.id) {
                ctx.strokeStyle = '#4CAF50';
                ctx.lineWidth = 5;
            } else if (relationTo === person.id) {
                ctx.strokeStyle = '#2196F3';
                ctx.lineWidth = 5;
            } else {
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 3;
            }
        } else {
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 3;
        }
        ctx.stroke();

        if (person.image) {
            if (!imageCache[person.id] || imageCache[person.id].src !== person.image) {
                imageCache[person.id] = new Image();
                imageCache[person.id].src = person.image;
                imageCache[person.id].onload = () => {
                    renderCanvas();
                };
            }

            const img = imageCache[person.id];
            if (img.complete) {
                ctx.save();
                ctx.beginPath();
                ctx.arc(person.x, person.y, 35, 0, Math.PI * 2);
                ctx.clip();
                ctx.drawImage(img, person.x - 35, person.y - 35, 70, 70);
                ctx.restore();
            }
        } else {
            ctx.font = 'bold 20px sans-serif';
            ctx.fillStyle = 'white';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(person.name[0], person.x, person.y);
        }

        ctx.font = 'bold 16px sans-serif';
        ctx.fillStyle = '#333';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(person.name, person.x, person.y + 45);
    });

    ctx.restore();
}

function getCanvasCoords(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = ((clientX - rect.left) * scaleX - offsetX * scale) / scale;
    const y = ((clientY - rect.top) * scaleY - offsetY * scale) / scale;
    return { x, y };
}

function handleCanvasMouseDown(e) {
    const { x, y } = getCanvasCoords(e.clientX, e.clientY);

    // Ctrl/Cmd + クリックで関係性追加モード
    const isModifierKey = e.ctrlKey || e.metaKey;

    // 関係性追加モードの場合（ボタンまたは修飾キー）
    if (addRelationMode || isModifierKey) {
        for (let person of people) {
            const dist = Math.sqrt((x - person.x) ** 2 + (y - person.y) ** 2);
            if (dist < 35) {
                if (!addRelationMode && isModifierKey) {
                    // 修飾キーで初めて押された場合、モードを有効化
                    addRelationMode = true;
                    canvas.style.cursor = 'crosshair';
                }
                handleRelationModeClick(person.id);
                return;
            }
        }
        // 修飾キーが押されているが人物をクリックしなかった場合は通常動作
        if (!addRelationMode) {
            // 何もしない（通常のドラッグ等を許可）
        } else {
            return;
        }
    }

    for (let labelPos of labelPositions) {
        if (x >= labelPos.x && x <= labelPos.x + labelPos.width &&
            y >= labelPos.y && y <= labelPos.y + labelPos.height) {
            draggingLabel = labelPos.relationshipId;
            canvas.style.cursor = 'grabbing';
            return;
        }
    }

    for (let person of people) {
        const dist = Math.sqrt((x - person.x) ** 2 + (y - person.y) ** 2);
        if (dist < 35) {
            dragging = person.id;
            canvas.style.cursor = 'grabbing';
            break;
        }
    }
}

function handleRelationModeClick(personId) {
    if (relationFrom === null) {
        relationFrom = personId;
        renderCanvas();
    } else if (relationTo === null) {
        if (relationFrom === personId) {
            alert('同じ人物は選択できません');
            return;
        }
        relationTo = personId;
        renderCanvas();

        // ラベル入力のプロンプトを表示
        setTimeout(() => {
            const label = prompt('関係性を入力してください（例: 憧れている）');
            if (label && label.trim()) {
                const newId = Math.max(...relationships.map(r => r.id), 0) + 1;
                relationships.push({
                    id: newId,
                    from: relationFrom,
                    to: relationTo,
                    label: label.trim(),
                    labelOffsetX: null,
                    labelOffsetY: null
                });
                render();
                saveToLocalStorage();
            }

            // モードをリセット
            cancelAddRelationMode();
        }, 100);
    }
}

function handleCanvasMouseMove(e) {
    const { x, y } = getCanvasCoords(e.clientX, e.clientY);

    if (draggingLabel !== null) {
        const rel = relationships.find(r => r.id === draggingLabel);
        if (rel) {
            rel.labelOffsetX = x;
            rel.labelOffsetY = y;
            renderCanvas();
            saveToLocalStorage();
        }
    } else if (dragging !== null) {
        const person = people.find(p => p.id === dragging);
        if (person) {
            person.x = Math.max(40, Math.min(canvasWidth - 40, x));
            person.y = Math.max(60, Math.min(canvasHeight - 60, y));
            renderCanvas();
            saveToLocalStorage();
        }
    } else {
        let hovering = false;

        for (let labelPos of labelPositions) {
            if (x >= labelPos.x && x <= labelPos.x + labelPos.width &&
                y >= labelPos.y && y <= labelPos.y + labelPos.height) {
                hovering = true;
                canvas.style.cursor = 'grab';
                return;
            }
        }

        for (let person of people) {
            const dist = Math.sqrt((x - person.x) ** 2 + (y - person.y) ** 2);
            if (dist < 35) {
                hovering = true;
                break;
            }
        }
        canvas.style.cursor = hovering ? 'grab' : 'default';
    }
}

function handleCanvasMouseUp() {
    dragging = null;
    draggingLabel = null;
    canvas.style.cursor = 'default';
}

function handleTouchStart(e) {
    e.preventDefault();

    if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        lastTouchDistance = Math.sqrt(dx * dx + dy * dy);
        return;
    }

    const touch = e.touches[0];
    const { x, y } = getCanvasCoords(touch.clientX, touch.clientY);

    // 関係性追加モードの場合
    if (addRelationMode) {
        for (let person of people) {
            const dist = Math.sqrt((x - person.x) ** 2 + (y - person.y) ** 2);
            if (dist < 35) {
                handleRelationModeClick(person.id);
                return;
            }
        }
        return;
    }

    for (let labelPos of labelPositions) {
        if (x >= labelPos.x && x <= labelPos.x + labelPos.width &&
            y >= labelPos.y && y <= labelPos.y + labelPos.height) {
            draggingLabel = labelPos.relationshipId;
            return;
        }
    }

    for (let person of people) {
        const dist = Math.sqrt((x - person.x) ** 2 + (y - person.y) ** 2);
        if (dist < 35) {
            dragging = person.id;
            break;
        }
    }
}

function handleTouchMove(e) {
    e.preventDefault();

    if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (lastTouchDistance > 0) {
            const delta = distance - lastTouchDistance;
            const zoomFactor = 1 + (delta * 0.01);
            const newScale = Math.max(minScale, Math.min(maxScale, scale * zoomFactor));
            scale = newScale;
            renderCanvas();
        }

        lastTouchDistance = distance;
        return;
    }

    if (dragging === null && draggingLabel === null) return;

    const touch = e.touches[0];
    const { x, y } = getCanvasCoords(touch.clientX, touch.clientY);

    if (draggingLabel !== null) {
        const rel = relationships.find(r => r.id === draggingLabel);
        if (rel) {
            rel.labelOffsetX = x;
            rel.labelOffsetY = y;
            renderCanvas();
        }
    } else if (dragging !== null) {
        const person = people.find(p => p.id === dragging);
        if (person) {
            person.x = Math.max(40, Math.min(canvasWidth - 40, x));
            person.y = Math.max(60, Math.min(canvasHeight - 60, y));
            renderCanvas();
        }
    }
}

function handleTouchEnd(e) {
    if (dragging !== null || draggingLabel !== null) {
        saveToLocalStorage();
    }
    dragging = null;
    draggingLabel = null;
    lastTouchDistance = 0;
}

function handleWheel(e) {
    e.preventDefault();

    const delta = -e.deltaY;
    const zoomFactor = delta > 0 ? 1.1 : 0.9;
    const newScale = Math.max(minScale, Math.min(maxScale, scale * zoomFactor));

    scale = newScale;
    renderCanvas();
}

function zoomIn() {
    const newScale = Math.min(maxScale, scale * 1.2);
    scale = newScale;
    renderCanvas();
}

function zoomOut() {
    const newScale = Math.max(minScale, scale / 1.2);
    scale = newScale;
    renderCanvas();
}

function resetZoom() {
    scale = 1.0;
    offsetX = 0;
    offsetY = 0;
    renderCanvas();
}

function showAddPersonForm() {
    renderColorPicker();
    document.getElementById('addPersonForm').style.display = 'block';
    document.getElementById('addPersonBtn').style.display = 'none';
    setTimeout(() => {
        document.getElementById('personName').focus();
    }, 100);
}

function cancelAddPerson() {
    document.getElementById('addPersonForm').style.display = 'none';
    document.getElementById('addPersonBtn').style.display = 'block';
    document.getElementById('personName').value = '';
}

function addPerson() {
    const name = document.getElementById('personName').value.trim();
    if (!name) return;

    const newId = Math.max(...people.map(p => p.id), 0) + 1;
    people.push({
        id: newId,
        name: name,
        x: canvasWidth / 2,
        y: canvasHeight / 2,
        image: null,
        color: selectedColor
    });

    cancelAddPerson();
    render();
    saveToLocalStorage();
}

function deletePerson(id) {
    if (confirm('この人物を削除しますか？')) {
        people = people.filter(p => p.id !== id);
        relationships = relationships.filter(r => r.from !== id && r.to !== id);
        render();
        saveToLocalStorage();
    }
}

function editPersonName(id) {
    const person = people.find(p => p.id === id);
    const newName = prompt('名前を入力してください', person.name);
    if (newName && newName.trim()) {
        person.name = newName.trim();
        render();
        saveToLocalStorage();
    }
}

function handleImageUpload(personId, event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const person = people.find(p => p.id === personId);
            if (person) {
                person.image = e.target.result;
                render();
                saveToLocalStorage();
            }
        };
        reader.readAsDataURL(file);
    }
}

function showAddRelationForm() {
    const fromSelect = document.getElementById('relationFrom');
    const toSelect = document.getElementById('relationTo');

    fromSelect.innerHTML = '<option value="">From（誰から）</option>';
    toSelect.innerHTML = '<option value="">To（誰へ）</option>';

    people.forEach(p => {
        fromSelect.innerHTML += `<option value="${p.id}">${p.name}</option>`;
        toSelect.innerHTML += `<option value="${p.id}">${p.name}</option>`;
    });

    document.getElementById('addRelationForm').style.display = 'block';
    document.getElementById('addRelationBtn').style.display = 'none';
}

function cancelAddRelation() {
    document.getElementById('addRelationForm').style.display = 'none';
    document.getElementById('addRelationBtn').style.display = 'block';
    document.getElementById('relationFrom').value = '';
    document.getElementById('relationTo').value = '';
    document.getElementById('relationLabel').value = '';
}

function addRelation() {
    const from = parseInt(document.getElementById('relationFrom').value);
    const to = parseInt(document.getElementById('relationTo').value);
    const label = document.getElementById('relationLabel').value.trim();

    if (!from || !to || !label) {
        alert('すべての項目を入力してください');
        return;
    }

    const newId = Math.max(...relationships.map(r => r.id), 0) + 1;
    relationships.push({
        id: newId,
        from: from,
        to: to,
        label: label,
        labelOffsetX: null,
        labelOffsetY: null
    });

    cancelAddRelation();
    render();
    saveToLocalStorage();
}

function deleteRelation(id) {
    if (confirm('この関係性を削除しますか？')) {
        relationships = relationships.filter(r => r.id !== id);
        render();
        saveToLocalStorage();
    }
}

function editRelationLabel(id) {
    const relation = relationships.find(r => r.id === id);
    const newLabel = prompt('関係性を入力してください', relation.label);
    if (newLabel && newLabel.trim()) {
        relation.label = newLabel.trim();
        render();
        saveToLocalStorage();
    }
}

function autoArrange() {
    if (people.length === 0) return;

    const margin = 80;
    const minDistance = 150;

    if (people.length === 1) {
        people[0].x = canvasWidth / 2;
        people[0].y = canvasHeight / 2;
    } else if (people.length === 2) {
        people[0].x = canvasWidth / 3;
        people[0].y = canvasHeight / 2;
        people[1].x = (canvasWidth / 3) * 2;
        people[1].y = canvasHeight / 2;
    } else if (people.length === 3) {
        const centerX = canvasWidth / 2;
        const centerY = canvasHeight / 2;
        const radius = Math.min(canvasWidth, canvasHeight) / 3;

        people[0].x = centerX + radius * Math.cos(-Math.PI / 2);
        people[0].y = centerY + radius * Math.sin(-Math.PI / 2);
        people[1].x = centerX + radius * Math.cos(Math.PI / 6);
        people[1].y = centerY + radius * Math.sin(Math.PI / 6);
        people[2].x = centerX + radius * Math.cos(Math.PI - Math.PI / 6);
        people[2].y = centerY + radius * Math.sin(Math.PI - Math.PI / 6);
    } else {
        const centerX = canvasWidth / 2;
        const centerY = canvasHeight / 2;
        const radius = Math.min(canvasWidth, canvasHeight) / 2.5;

        people.forEach((person, index) => {
            const angle = (index / people.length) * Math.PI * 2 - Math.PI / 2;
            person.x = centerX + radius * Math.cos(angle);
            person.y = centerY + radius * Math.sin(angle);
        });
    }

    people.forEach(person => {
        person.x = Math.max(margin, Math.min(canvasWidth - margin, person.x));
        person.y = Math.max(margin, Math.min(canvasHeight - margin, person.y));
    });

    render();
    saveToLocalStorage();
}

function saveAsImage() {
    // Create a high-resolution canvas for export (3x resolution)
    const exportScale = 3;
    const exportCanvas = document.createElement('canvas');
    const exportCtx = exportCanvas.getContext('2d');

    // Set high-resolution dimensions
    exportCanvas.width = canvasWidth * exportScale;
    exportCanvas.height = canvasHeight * exportScale;

    // Scale the context
    exportCtx.scale(exportScale, exportScale);

    // Fill background with white
    exportCtx.fillStyle = 'white';
    exportCtx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Draw all relationships
    relationships.forEach(rel => {
        const from = people.find(p => p.id === rel.from);
        const to = people.find(p => p.id === rel.to);

        if (from && to) {
            const fromX = from.x;
            const fromY = from.y;
            const toX = to.x;
            const toY = to.y;

            // Calculate angle
            const angle = Math.atan2(toY - fromY, toX - fromX);

            // Offset start and end points to be at edge of circles
            const radius = 50;
            const startX = fromX + Math.cos(angle) * radius;
            const startY = fromY + Math.sin(angle) * radius;
            const endX = toX - Math.cos(angle) * radius;
            const endY = toY - Math.sin(angle) * radius;

            // Draw line
            exportCtx.strokeStyle = '#ec4899';
            exportCtx.lineWidth = 3;
            exportCtx.globalAlpha = 0.6;
            exportCtx.beginPath();
            exportCtx.moveTo(startX, startY);
            exportCtx.lineTo(endX, endY);
            exportCtx.stroke();
            exportCtx.globalAlpha = 1.0;

            // Draw arrow
            const arrowLength = 15;
            const arrowAngle = Math.PI / 6;
            exportCtx.fillStyle = '#ec4899';
            exportCtx.globalAlpha = 0.8;
            exportCtx.beginPath();
            exportCtx.moveTo(endX, endY);
            exportCtx.lineTo(
                endX - arrowLength * Math.cos(angle - arrowAngle),
                endY - arrowLength * Math.sin(angle - arrowAngle)
            );
            exportCtx.lineTo(
                endX - arrowLength * Math.cos(angle + arrowAngle),
                endY - arrowLength * Math.sin(angle + arrowAngle)
            );
            exportCtx.closePath();
            exportCtx.fill();
            exportCtx.globalAlpha = 1.0;

            // Draw label
            const midX = (fromX + toX) / 2 + (rel.labelOffsetX || 0);
            const midY = (fromY + toY) / 2 + (rel.labelOffsetY || 0);

            if (rel.label) {
                exportCtx.font = 'bold 16px sans-serif';
                exportCtx.fillStyle = '#333';
                exportCtx.textAlign = 'center';
                exportCtx.textBaseline = 'middle';

                // Draw background for label
                const metrics = exportCtx.measureText(rel.label);
                const padding = 8;
                exportCtx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                exportCtx.fillRect(
                    midX - metrics.width / 2 - padding,
                    midY - 12,
                    metrics.width + padding * 2,
                    24
                );

                exportCtx.fillStyle = '#333';
                exportCtx.fillText(rel.label, midX, midY);
            }
        }
    });

    // Draw all people
    people.forEach(person => {
        const x = person.x;
        const y = person.y;
        const radius = 50;

        // Draw circle
        exportCtx.fillStyle = person.color || '#3b82f6';
        exportCtx.beginPath();
        exportCtx.arc(x, y, radius, 0, Math.PI * 2);
        exportCtx.fill();

        // Draw white border
        exportCtx.strokeStyle = 'white';
        exportCtx.lineWidth = 4;
        exportCtx.stroke();

        // Draw image if exists
        if (person.image && imageCache[person.id]) {
            exportCtx.save();
            exportCtx.beginPath();
            exportCtx.arc(x, y, radius, 0, Math.PI * 2);
            exportCtx.clip();
            exportCtx.drawImage(imageCache[person.id], x - radius, y - radius, radius * 2, radius * 2);
            exportCtx.restore();
        } else {
            // Draw initial letter
            exportCtx.fillStyle = 'white';
            exportCtx.font = 'bold 32px sans-serif';
            exportCtx.textAlign = 'center';
            exportCtx.textBaseline = 'middle';
            exportCtx.fillText(person.name.charAt(0), x, y);
        }

        // Draw name below circle
        exportCtx.fillStyle = '#333';
        exportCtx.font = 'bold 18px sans-serif';
        exportCtx.textAlign = 'center';
        exportCtx.textBaseline = 'top';

        // Draw background for name
        const nameMetrics = exportCtx.measureText(person.name);
        const namePadding = 6;
        exportCtx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        exportCtx.fillRect(
            x - nameMetrics.width / 2 - namePadding,
            y + radius + 5,
            nameMetrics.width + namePadding * 2,
            24
        );

        exportCtx.fillStyle = '#333';
        exportCtx.fillText(person.name, x, y + radius + 10);
    });

    // Convert to high-quality PNG and download
    const link = document.createElement('a');
    link.download = '相関図.png';
    link.href = exportCanvas.toDataURL('image/png', 1.0);
    link.click();
}

function saveToLocalStorage() {
    const data = { people, relationships };
    localStorage.setItem('relationshipDiagram', JSON.stringify(data));
    showAutoSaveIndicator();
    updateOGPTags();
}

function updateOGPTags() {
    // Temporarily disabled - use static OGP image for now
    // Dynamic OGP generation will be re-enabled later with proper PNG support

    // Generate a descriptive title based on people in the diagram
    if (people.length > 0) {
        const names = people.slice(0, 3).map(p => p.name).join('、');
        const suffix = people.length > 3 ? `ほか${people.length}人` : '';
        const title = `${names}${suffix}の相関図`;
        const description = `${people.length}人の相関図を作成しました`;

        // Update title and description
        const ogTitle = document.getElementById('ogTitle');
        const ogDescription = document.getElementById('ogDescription');
        const twitterTitle = document.getElementById('twitterTitle');
        const twitterDescription = document.getElementById('twitterDescription');

        if (ogTitle) ogTitle.setAttribute('content', title);
        if (ogDescription) ogDescription.setAttribute('content', description);
        if (twitterTitle) twitterTitle.setAttribute('content', title);
        if (twitterDescription) twitterDescription.setAttribute('content', description);
    }
}

function loadFromLocalStorage() {
    const saved = localStorage.getItem('relationshipDiagram');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            people = data.people;
            relationships = data.relationships;
        } catch (error) {
            console.error('データの読み込みに失敗しました', error);
            initializeDefaultData();
        }
    } else {
        // データがない場合はデフォルトを中央に配置
        initializeDefaultData();
    }
}

function initializeDefaultData() {
    // キャンバスの中心座標を計算
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;

    people = [
        { id: 1, name: '太郎', x: centerX - 150, y: centerY - 75, image: null, color: '#3b82f6' },
        { id: 2, name: '花子', x: centerX + 150, y: centerY - 75, image: null, color: '#ec4899' },
        { id: 3, name: '次郎', x: centerX, y: centerY + 100, image: null, color: '#10b981' }
    ];

    relationships = [
        { id: 1, from: 1, to: 2, label: '憧れている', labelOffsetX: null, labelOffsetY: null },
        { id: 2, from: 2, to: 3, label: '親友', labelOffsetX: null, labelOffsetY: null },
        { id: 3, from: 3, to: 1, label: 'ライバル視', labelOffsetX: null, labelOffsetY: null }
    ];
}

function showAutoSaveIndicator() {
    const indicator = document.getElementById('autoSaveIndicator');
    indicator.classList.add('show');
    setTimeout(() => {
        indicator.classList.remove('show');
    }, 2000);
}

function shareTwitter() {
    const data = { people, relationships };
    const encodedData = encodeURIComponent(JSON.stringify(data));
    const shareUrl = `${window.location.origin}/api/share?data=${encodedData}`;
    const text = '相関図を作成しました！ #相関図ジェネレーター';
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`, '_blank');
}

function shareFacebook() {
    const data = { people, relationships };
    const encodedData = encodeURIComponent(JSON.stringify(data));
    const shareUrl = `${window.location.origin}/api/share?data=${encodedData}`;
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank');
}

function shareLine() {
    const data = { people, relationships };
    const encodedData = encodeURIComponent(JSON.stringify(data));
    const shareUrl = `${window.location.origin}/api/share?data=${encodedData}`;
    const text = '相関図を作成しました！';
    window.open(`https://line.me/R/msg/text/?${encodeURIComponent(text + ' ' + shareUrl)}`, '_blank');
}

function openShareModal() {
    document.getElementById('shareModal').style.display = 'flex';
}

function closeShareModal() {
    document.getElementById('shareModal').style.display = 'none';
}

function shareInstagram() {
    // Instagram doesn't have direct web share, redirect to Instagram app or show message
    const text = '相関図を作成しました！';
    const url = window.location.href;
    // Try to use Web Share API if available
    if (navigator.share) {
        navigator.share({
            title: '相関図ジェネレーター',
            text: text,
            url: url
        }).catch(() => {});
    } else {
        alert('Instagram アプリでシェアしてください。リンクをコピーします。');
        navigator.clipboard.writeText(url);
    }
}

function shareReddit() {
    const data = { people, relationships };
    const encodedData = encodeURIComponent(JSON.stringify(data));
    const shareUrl = `${window.location.origin}/api/share?data=${encodedData}`;
    const text = '相関図を作成しました！';
    window.open(`https://www.reddit.com/submit?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(text)}`, '_blank');
}

function sharePinterest() {
    const data = { people, relationships };
    const encodedData = encodeURIComponent(JSON.stringify(data));
    const shareUrl = `${window.location.origin}/api/share?data=${encodedData}`;
    const imageUrl = `${window.location.origin}/api/og-image?data=${encodedData}`;
    const description = '相関図を作成しました！';
    window.open(`https://pinterest.com/pin/create/button/?url=${encodeURIComponent(shareUrl)}&description=${encodeURIComponent(description)}&media=${encodeURIComponent(imageUrl)}`, '_blank');
}

function copyLink() {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
        closeShareModal();
        alert('リンクをコピーしました！');
    }).catch(() => {
        alert('コピーに失敗しました');
    });
}
