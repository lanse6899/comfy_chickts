// Chick Temporary Save - 图片临时存储插件

// 创建悬浮按钮
function createButton() {
    // 检查按钮是否已存在
    if (document.querySelector('.chick-btn')) {
        return;
    }
    
    // 创建按钮元素
    const button = document.createElement('button');
    button.className = 'chick-btn';
    button.innerHTML = '🐣';
    button.title = 'Chick Temporary Save';
    
    // 按钮样式 - 放在屏幕中间
    const buttonSize = 50;
    
    button.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: ${buttonSize}px;
        height: ${buttonSize}px;
        background: linear-gradient(135deg, #4a90e2 0%, #357abd 100%);
        border: 2px solid #357abd;
        border-radius: 50%;
        color: white;
        font-size: 24px;
        cursor: pointer;
        z-index: 9999;
        box-shadow: 0 4px 15px rgba(74, 144, 226, 0.4);
        transition: transform 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    
    // 悬停效果
    button.addEventListener('mouseenter', () => {
        button.style.transform = 'translate(-50%, -50%) scale(1.1)';
    });
    
    button.addEventListener('mouseleave', () => {
        button.style.transform = 'translate(-50%, -50%) scale(1)';
    });
    
    // 拖拽功能
    let isDragging = false;
    let dragStartX, dragStartY;
    let buttonStartX, buttonStartY;
    let hasMoved = false;
    
    button.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        
        isDragging = true;
        hasMoved = false;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        
        const rect = button.getBoundingClientRect();
        buttonStartX = rect.left;
        buttonStartY = rect.top;
        
        button.style.cursor = 'grabbing';
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const deltaX = e.clientX - dragStartX;
        const deltaY = e.clientY - dragStartY;
        
        if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
            hasMoved = true;
        }
        
        // 计算新位置（考虑按钮中心点）
        const buttonCenterX = buttonStartX + button.offsetWidth / 2 + deltaX;
        const buttonCenterY = buttonStartY + button.offsetHeight / 2 + deltaY;
        
        // 限制在屏幕范围内
        const maxX = window.innerWidth - button.offsetWidth / 2;
        const maxY = window.innerHeight - button.offsetHeight / 2;
        const minX = button.offsetWidth / 2;
        const minY = button.offsetHeight / 2;
        
        const newX = Math.max(minX, Math.min(buttonCenterX, maxX));
        const newY = Math.max(minY, Math.min(buttonCenterY, maxY));
        
        button.style.left = newX + 'px';
        button.style.top = newY + 'px';
        button.style.right = 'auto';
        button.style.bottom = 'auto';
        button.style.transform = 'translate(-50%, -50%)';
    });
    
    document.addEventListener('mouseup', (e) => {
        if (isDragging) {
            isDragging = false;
            button.style.cursor = 'pointer';
            
            if (!hasMoved) {
                toggleBrowser();
            }
        }
    });
    
    document.body.appendChild(button);
}

// 图片存储
let imageStorage = [];
// 选中的图片ID
let selectedImages = [];
// 记录最后一次作为锚点的图片ID（用于Shift范围选择）
let lastSelectedId = null;

// 辅助函数：统一处理ID比较（支持数字和字符串类型）
function compareIds(id1, id2) {
    return String(id1) === String(id2);
}

// 辅助函数：检查ID是否在数组中
function isIdInArray(array, id) {
    return array.some(item => compareIds(item, id));
}

// 存储配置
let storageConfig = {
    use_file_storage: true,  // 默认使用文件系统存储
    storage_dir: ''
};
// 保存防抖定时器
let saveDebounceTimer = null;
// 保存操作进行中标志
let isSaving = false;
// 预览模式状态
let previewMode = false;
// 预览窗口相对于浏览器窗口的偏移量（用于跟随移动）
let previewWindowOffsetX = 0;
let previewWindowOffsetY = 0;

// 缩略图尺寸配置
const THUMBNAIL_SIZE_KEY = 'chick-thumbnail-size';
const THUMBNAIL_SIZE_MIN = 80;
const THUMBNAIL_SIZE_MAX = 320;
const THUMBNAIL_SIZE_DEFAULT = 80;
let thumbnailSize = loadThumbnailSize();
// 支持的视频类型
const SUPPORTED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

// 获取ComfyUI app实例
function getComfyApp() {
    if (window.app) {
        return window.app;
    }
    return null;
}

// 切换浏览器显示/隐藏
function toggleBrowser() {
    let browser = document.getElementById('chick-browser');
    
    if (browser) {
        if (browser.style.display === 'none') {
            browser.style.display = 'flex';
            renderImages();
        } else {
            browser.style.display = 'none';
        }
    } else {
        createBrowser();
    }
}

// 计算列数（根据窗口宽度）
function calculateColumns(width) {
    // 减去padding (15px * 2) 和 gap (10px * (cols-1))
    const contentWidth = width - 30; // 左右padding
    // 根据缩略图尺寸动态计算最小宽度（保证调大尺寸时能减列放大）
    const minItemWidth = Math.max(thumbnailSize, THUMBNAIL_SIZE_MIN);
    const gap = 10;
    // 计算可以放多少列
    const cols = Math.max(1, Math.floor((contentWidth + gap) / (minItemWidth + gap)));
    return Math.min(cols, 10); // 最多10列
}

// 更新列数
function updateColumns() {
    const browser = document.getElementById('chick-browser');
    const imagesContainer = document.getElementById('chick-images');
    if (!browser || !imagesContainer) return;
    
    const width = browser.offsetWidth;
    const cols = calculateColumns(width);
    imagesContainer.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
}

// 保存窗口大小
function saveWindowSize(width, height) {
    try {
        localStorage.setItem('chick-window-size', JSON.stringify({ width, height }));
    } catch (e) {
        console.error('保存窗口大小失败:', e);
    }
}

// 加载窗口大小
function loadWindowSize() {
    try {
        const saved = localStorage.getItem('chick-window-size');
        if (saved) {
            return JSON.parse(saved);
        }
    } catch (e) {
        console.error('加载窗口大小失败:', e);
    }
    return null;
}

// 保存缩略图尺寸
function saveThumbnailSize(size) {
    try {
        const clamped = Math.min(Math.max(size, THUMBNAIL_SIZE_MIN), THUMBNAIL_SIZE_MAX);
        localStorage.setItem(THUMBNAIL_SIZE_KEY, String(clamped));
        thumbnailSize = clamped;
    } catch (e) {
        console.error('保存缩略图尺寸失败:', e);
    }
}

// 加载缩略图尺寸
function loadThumbnailSize() {
    try {
        const saved = parseInt(localStorage.getItem(THUMBNAIL_SIZE_KEY), 10);
        if (Number.isFinite(saved) && saved >= THUMBNAIL_SIZE_MIN && saved <= THUMBNAIL_SIZE_MAX) {
            return saved;
        }
    } catch (e) {
        console.error('加载缩略图尺寸失败:', e);
    }
    return THUMBNAIL_SIZE_DEFAULT;
}

// 创建浏览器窗口
function createBrowser() {
    // 尝试加载保存的窗口大小
    const savedSize = loadWindowSize();
    const width = savedSize ? savedSize.width : 420;  // 默认宽度420px
    const height = savedSize ? savedSize.height : (window.innerHeight - 180);  // 默认高度
    const left = 70;  // 左侧70px，避开侧边栏
    const top = 80;   // 顶部80px，往下移动
    
    const browser = document.createElement('div');
    browser.id = 'chick-browser';
    
    browser.style.cssText = `
        position: fixed;
        left: ${left}px;
        top: ${top}px;
        width: ${width}px;
        height: ${height}px;
        background: #2a2a2a;
        border: 1px solid #444;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8);
        z-index: 9998;
        display: flex;
        flex-direction: column;
        font-family: 'Segoe UI', Arial, sans-serif;
    `;
    
    browser.innerHTML = `
        <!-- 标题栏 -->
        <div id="chick-title-bar" style="
            background: linear-gradient(135deg, #4a90e2 0%, #357abd 100%);
            color: white;
            padding: 12px 15px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-radius: 10px 10px 0 0;
            cursor: move;
            user-select: none;
        ">
            <div style="font-size: 16px; font-weight: bold;">
                🐣 Chick Temporary Save
            </div>
            <button id="chick-close-btn" style="
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.2);
                color: white;
                font-size: 18px;
                cursor: pointer;
                padding: 2px 8px;
                border-radius: 4px;
                transition: background 0.2s;
            " onmouseover="this.style.background='rgba(255,255,255,0.2)'" onmouseout="this.style.background='rgba(255,255,255,0.1)'">✕</button>
        </div>
        <!-- 工具栏（放在标题下方） -->
        <div id="chick-toolbar" style="
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            padding: 10px 15px;
            background: #2f2f2f;
            border-bottom: 1px solid #444;
            align-items: center;
        ">
            <button id="chick-select-all-btn" title="全选" style="
                background: rgba(255, 255, 255, 0.15);
                border: 1px solid rgba(255, 255, 255, 0.3);
                color: white;
                font-size: 14px;
                cursor: pointer;
                padding: 4px 8px;
                border-radius: 4px;
                transition: background 0.2s;
                display: none;
                align-items: center;
                justify-content: center;
            " onmouseover="this.style.background='rgba(255,255,255,0.25)'" onmouseout="this.style.background='rgba(255,255,255,0.15)'">☑</button>
            <button id="chick-delete-selected-btn" title="删除选中" style="
                background: rgba(231, 76, 60, 0.8);
                border: 1px solid rgba(231, 76, 60, 0.9);
                color: white;
                font-size: 14px;
                cursor: pointer;
                padding: 4px 8px;
                border-radius: 4px;
                transition: background 0.2s, opacity 0.2s;
                display: flex;
                align-items: center;
                justify-content: center;
            " onmouseover="if(!this.disabled) this.style.background='rgba(231,76,60,0.9)'" onmouseout="if(!this.disabled) this.style.background='rgba(231,76,60,0.8)'">🗑️</button>
            <button id="chick-export-btn" title="导出选中" style="
                background: rgba(76, 175, 80, 0.8);
                border: 1px solid rgba(76, 175, 80, 0.9);
                color: white;
                font-size: 14px;
                cursor: pointer;
                padding: 4px 8px;
                border-radius: 4px;
                transition: background 0.2s, opacity 0.2s;
                display: flex;
                align-items: center;
                justify-content: center;
            " onmouseover="if(!this.disabled) this.style.background='rgba(76,175,80,0.9)'" onmouseout="if(!this.disabled) this.style.background='rgba(76,175,80,0.8)'">📤</button>
            <button id="chick-save-btn" title="保存选中" style="
                background: rgba(255, 152, 0, 0.8);
                border: 1px solid rgba(255, 152, 0, 0.9);
                color: white;
                font-size: 14px;
                cursor: pointer;
                padding: 4px 8px;
                border-radius: 4px;
                transition: background 0.2s, opacity 0.2s;
                display: flex;
                align-items: center;
                justify-content: center;
            " onmouseover="if(!this.disabled) this.style.background='rgba(255,152,0,0.9)'" onmouseout="if(!this.disabled) this.style.background='rgba(255,152,0,0.8)'">💾</button>
            <button id="chick-paste-btn" title="粘贴" style="
                background: rgba(255, 255, 255, 0.15);
                border: 1px solid rgba(255, 255, 255, 0.3);
                color: white;
                font-size: 14px;
                cursor: pointer;
                padding: 4px 8px;
                border-radius: 4px;
                transition: background 0.2s;
                display: flex;
                align-items: center;
                justify-content: center;
            " onmouseover="this.style.background='rgba(255,255,255,0.25)'" onmouseout="this.style.background='rgba(255,255,255,0.15)'">📋</button>
            <button id="chick-upload-btn" title="上传" style="
                background: rgba(255, 255, 255, 0.15);
                border: 1px solid rgba(255, 255, 255, 0.3);
                color: white;
                font-size: 14px;
                cursor: pointer;
                padding: 4px 8px;
                border-radius: 4px;
                transition: background 0.2s;
                display: flex;
                align-items: center;
                justify-content: center;
            " onmouseover="this.style.background='rgba(255,255,255,0.25)'" onmouseout="this.style.background='rgba(255,255,255,0.15)'">📤</button>
            <div id="chick-folder-load-container" style="
                display: flex;
                align-items: center;
                gap: 4px;
                background: rgba(0, 0, 0, 0.15);
                border: 1px solid rgba(255, 255, 255, 0.2);
                padding: 4px 8px;
                border-radius: 4px;
                flex: 1;
                min-width: 200px;
            ">
                <input id="chick-folder-path-input" type="text" placeholder="输入文件夹路径..." style="
                    background: rgba(0, 0, 0, 0.3);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    color: white;
                    font-size: 12px;
                    padding: 4px 8px;
                    border-radius: 4px;
                    flex: 1;
                    min-width: 0;
                    outline: none;
                " />
                <button id="chick-load-folder-btn" title="从文件夹加载图片" style="
                    background: rgba(156, 39, 176, 0.8);
                    border: 1px solid rgba(156, 39, 176, 0.9);
                    color: white;
                    font-size: 12px;
                    cursor: pointer;
                    padding: 4px 8px;
                    border-radius: 4px;
                    transition: background 0.2s;
                    white-space: nowrap;
                " onmouseover="this.style.background='rgba(156,39,176,0.9)'" onmouseout="this.style.background='rgba(156,39,176,0.8)'">📁 加载</button>
            </div>
            <button id="chick-metadata-toggle-btn" title="显示/隐藏元数据" style="
                background: rgba(255, 255, 255, 0.15);
                border: 1px solid rgba(255, 255, 255, 0.3);
                color: white;
                font-size: 14px;
                cursor: pointer;
                padding: 4px 8px;
                border-radius: 4px;
                transition: background 0.2s;
                display: flex;
                align-items: center;
                justify-content: center;
            " onmouseover="this.style.background='rgba(255,255,255,0.25)'" onmouseout="this.style.background='rgba(255,255,255,0.15)'">🔑</button>
            <button id="chick-preview-mode-btn" title="放大预览模式" style="
                background: rgba(255, 255, 255, 0.15);
                border: 1px solid rgba(255, 255, 255, 0.3);
                color: white;
                font-size: 14px;
                cursor: pointer;
                padding: 4px 8px;
                border-radius: 4px;
                transition: background 0.2s;
                display: flex;
                align-items: center;
                justify-content: center;
            " onmouseover="this.style.background='rgba(255,255,255,0.25)'" onmouseout="this.style.background='rgba(255,255,255,0.15)'">👁️‍🗨️</button>
            <div id="chick-thumb-size-control" style="
                display: flex;
                align-items: center;
                gap: 6px;
                background: rgba(0, 0, 0, 0.15);
                border: 1px solid rgba(255, 255, 255, 0.2);
                color: white;
                font-size: 12px;
                padding: 4px 8px;
                border-radius: 6px;
            ">
                <span style="opacity: 0.85;">缩略图</span>
                <input id="chick-thumb-size-range" type="range" min="${THUMBNAIL_SIZE_MIN}" max="${THUMBNAIL_SIZE_MAX}" value="${thumbnailSize}" style="
                    width: 90px;
                    accent-color: #4a90e2;
                    cursor: pointer;
                " />
                <span id="chick-thumb-size-value" style="min-width: 52px; text-align: right;">${thumbnailSize}px</span>
            </div>
        </div>
        
        <!-- 主内容区 -->
        <div style="flex: 1; display: flex; flex-direction: column; overflow: hidden; position: relative;">
            <div id="chick-content" style="flex: 1; padding: 15px; overflow: auto; background: #2a2a2a; position: relative;">
                <div id="chick-images" style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px;">
                </div>
                <div id="chick-drop-zone" style="
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    border: 2px dashed #4a90e2;
                    border-radius: 8px;
                    background: rgba(74, 144, 226, 0.1);
                    display: none;
                    align-items: center;
                    justify-content: center;
                    pointer-events: none;
                    z-index: 10;
                ">
                    <div style="color: #4a90e2; font-size: 18px; font-weight: bold;">释放以上传图片</div>
                </div>
            </div>
            <!-- 元数据显示区域 -->
            <div id="chick-metadata-panel" style="
                border-top: 2px solid #555;
                background: #1a1a1a;
                height: 250px;
                overflow-y: auto;
                display: none;
                padding: 15px;
                flex-shrink: 0;
            ">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <div style="color: #4a90e2; font-size: 14px; font-weight: bold;">📋 图片元数据</div>
                    <button id="chick-metadata-close" style="
                        background: rgba(255, 255, 255, 0.1);
                        border: 1px solid rgba(255, 255, 255, 0.2);
                        color: white;
                        font-size: 16px;
                        cursor: pointer;
                        padding: 4px 10px;
                        border-radius: 4px;
                        transition: background 0.2s;
                    " onmouseover="this.style.background='rgba(255,255,255,0.2)'" onmouseout="this.style.background='rgba(255,255,255,0.1)'">✕</button>
                </div>
                <div id="chick-metadata-content" style="color: #ccc; font-size: 12px; line-height: 1.6;">
                    <div style="text-align: center; color: #666; padding: 20px;">点击图片查看元数据</div>
                </div>
            </div>
        </div>
        <!-- 缩放手柄 -->
        <div id="chick-resize-handle" style="
            position: absolute;
            bottom: 0;
            right: 0;
            width: 20px;
            height: 20px;
            cursor: nwse-resize;
            z-index: 10000;
            background: linear-gradient(-45deg, transparent 40%, rgba(255,255,255,0.3) 40%, rgba(255,255,255,0.3) 45%, transparent 45%, transparent 55%, rgba(255,255,255,0.3) 55%, rgba(255,255,255,0.3) 60%, transparent 60%);
        "></div>
        
        <!-- 预览窗口 -->
        <div id="chick-preview-window" style="
            position: fixed;
            display: none;
            z-index: 10001;
            background: rgba(0, 0, 0, 0.95);
            border: none;
            border-radius: 8px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8);
            padding: 10px;
            max-width: 80vw;
            max-height: 80vh;
        ">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <div style="color: #4a90e2; font-size: 14px; font-weight: bold;">🔍 预览</div>
                <button id="chick-preview-close" style="
                    background: rgba(255, 255, 255, 0.1);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    color: white;
                    font-size: 16px;
                    cursor: pointer;
                    padding: 4px 10px;
                    border-radius: 4px;
                    transition: background 0.2s;
                " onmouseover="this.style.background='rgba(255,255,255,0.2)'" onmouseout="this.style.background='rgba(255,255,255,0.1)'">✕</button>
            </div>
        <div id="chick-preview-content" style="
            display: flex;
            align-items: center;
            justify-content: center;
            max-width: 100%;
            max-height: calc(80vh - 50px);
            overflow: hidden;
        ">
            <img id="chick-preview-image" src="" style="
                max-width: 100%;
                max-height: 100%;
                object-fit: contain;
                display: none;
                transition: opacity 0.2s ease-in;
            " />
            <video id="chick-preview-video" style="
                max-width: 100%;
                max-height: 100%;
                display: none;
                background: #000;
            " controls playsinline></video>
            <!-- 文档预览容器 -->
            <div id="chick-preview-document" style="
                display: none;
                width: 100%;
                height: 100%;
                max-width: 100%;
                max-height: calc(80vh - 50px);
                overflow: auto;
                background: #1a1a1a;
                color: #ddd;
                font-family: 'Consolas', 'Monaco', monospace;
                font-size: 13px;
                line-height: 1.6;
                padding: 15px;
                box-sizing: border-box;
                white-space: pre-wrap;
                word-wrap: break-word;
            "></div>
        </div>
        </div>
    `;
    
    document.body.appendChild(browser);
    
    // 绑定关闭按钮事件
    document.getElementById('chick-close-btn').addEventListener('click', () => {
        browser.style.display = 'none';
    });
    
    // 绑定元数据面板关闭按钮事件
    const metadataCloseBtn = document.getElementById('chick-metadata-close');
    if (metadataCloseBtn) {
        metadataCloseBtn.addEventListener('click', () => {
            const metadataPanel = document.getElementById('chick-metadata-panel');
            const toggleBtn = document.getElementById('chick-metadata-toggle-btn');
            if (metadataPanel) {
                metadataPanel.style.display = 'none';
                if (toggleBtn) {
                    toggleBtn.style.background = 'rgba(255, 255, 255, 0.15)';
                    toggleBtn.title = '显示元数据';
                }
                saveMetadataPanelState(false);
            }
        });
    }
    
    // 绑定元数据面板切换按钮事件
    const metadataToggleBtn = document.getElementById('chick-metadata-toggle-btn');
    if (metadataToggleBtn) {
        // 加载保存的状态
        const savedState = loadMetadataPanelState();
        const metadataPanel = document.getElementById('chick-metadata-panel');
        if (metadataPanel) {
            if (savedState) {
                metadataPanel.style.display = 'block';
                metadataToggleBtn.style.background = 'rgba(74, 144, 226, 0.6)';
                metadataToggleBtn.style.borderColor = 'rgba(74, 144, 226, 0.8)';
                metadataToggleBtn.innerHTML = '🔓'; // 开启状态：解锁图标
                metadataToggleBtn.title = '隐藏元数据';
            } else {
                metadataPanel.style.display = 'none';
                metadataToggleBtn.style.background = 'rgba(255, 255, 255, 0.15)';
                metadataToggleBtn.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                metadataToggleBtn.innerHTML = '🔑'; // 关闭状态：锁图标
                metadataToggleBtn.title = '显示元数据';
            }
        }
        
        metadataToggleBtn.addEventListener('click', () => {
            toggleMetadataPanel();
        });
    }
    
    // 绑定预览模式按钮事件
    const previewModeBtn = document.getElementById('chick-preview-mode-btn');
    if (previewModeBtn) {
        previewModeBtn.addEventListener('click', () => {
            togglePreviewMode();
        });
    }
    
    // 绑定缩略图尺寸控制
    const thumbSizeRange = document.getElementById('chick-thumb-size-range');
    const thumbSizeValue = document.getElementById('chick-thumb-size-value');
    if (thumbSizeRange && thumbSizeValue) {
        thumbSizeRange.value = thumbnailSize;
        thumbSizeValue.textContent = `${thumbnailSize}px`;
        
        thumbSizeRange.addEventListener('input', () => {
            const newSize = parseInt(thumbSizeRange.value, 10);
            const clamped = Math.min(Math.max(newSize || THUMBNAIL_SIZE_DEFAULT, THUMBNAIL_SIZE_MIN), THUMBNAIL_SIZE_MAX);
            thumbnailSize = clamped;
            thumbSizeRange.value = clamped;
            thumbSizeValue.textContent = `${clamped}px`;
            saveThumbnailSize(clamped);
            renderImages();
        });
    }
    
    // 绑定预览窗口关闭按钮事件
    const previewCloseBtn = document.getElementById('chick-preview-close');
    if (previewCloseBtn) {
        previewCloseBtn.addEventListener('click', () => {
            const previewWindow = document.getElementById('chick-preview-window');
            const previewVideo = document.getElementById('chick-preview-video');
            if (previewWindow) {
                previewWindow.style.display = 'none';
            }
            if (previewVideo) {
                previewVideo.pause();
            }
        });
    }
    
    // 绑定粘贴按钮事件（无需快捷键）
    const pasteBtn = document.getElementById('chick-paste-btn');
    if (pasteBtn) {
        pasteBtn.addEventListener('click', async () => {
            try {
                let imageFound = false;
                
                // 优先使用 Clipboard API 直接读取图片
                if (navigator.clipboard && navigator.clipboard.read) {
                    const items = await navigator.clipboard.read();
                    for (const item of items) {
                        for (const type of item.types) {
                            if (type.startsWith('image/')) {
                                const blob = await item.getType(type);
                                const file = new File([blob], `pasted_${Date.now()}.png`, { type });
                                handleMediaFile(file);
                                imageFound = true;
                            }
                        }
                    }
                }
                
                // 备用方案：读取文本中的 DataURL 或图片链接并转成文件
                if (!imageFound && navigator.clipboard && navigator.clipboard.readText) {
                    const text = (await navigator.clipboard.readText()).trim();
                    if (text) {
                        // Data URL
                        if (text.startsWith('data:image/')) {
                            const response = await fetch(text);
                            const blob = await response.blob();
                            const file = new File([blob], `pasted_${Date.now()}.png`, { type: blob.type || 'image/png' });
                            handleMediaFile(file);
                            imageFound = true;
                        } else {
                            // http/https 图片链接
                            const imgUrlPattern = /^https?:\/\/.+\.(png|jpg|jpeg|webp|gif)$/i;
                            if (imgUrlPattern.test(text)) {
                                const response = await fetch(text);
                                if (response.ok) {
                                    const blob = await response.blob();
                                    const file = new File([blob], `pasted_${Date.now()}.png`, { type: blob.type || 'image/png' });
                                    handleMediaFile(file);
                                    imageFound = true;
                                }
                            }
                        }
                    }
                }
                
                if (imageFound) {
                    showTempNotification('✅ 已粘贴图片');
                } else {
                    showWarningNotification('剪贴板中没有可用的图片，或浏览器未授予读取权限');
                }
            } catch (err) {
                console.error('粘贴失败:', err);
                showWarningNotification('读取剪贴板失败，请检查权限后再试');
            }
        });
    }
    
    // 绑定上传按钮事件
    document.getElementById('chick-upload-btn').addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        // 支持图片、视频和文档
        input.accept = 'image/*,video/*,.txt,.md,.py,.js,.html,.css,.json,.xml,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        input.multiple = true;
        input.onchange = (e) => {
            const files = Array.from(e.target.files);
            files.forEach(file => {
                handleMediaFile(file);
            });
        };
        input.click();
    });
    
    // 绑定文件夹加载按钮事件
    const folderLoadBtn = document.getElementById('chick-load-folder-btn');
    const folderPathInput = document.getElementById('chick-folder-path-input');
    
    if (folderLoadBtn) {
        folderLoadBtn.addEventListener('click', async () => {
            const folderPath = folderPathInput.value.trim();
            if (!folderPath) {
                showWarningNotification('请输入文件夹路径');
                return;
            }
            
            // 显示加载状态
            folderLoadBtn.disabled = true;
            folderLoadBtn.textContent = '加载中...';
            folderLoadBtn.style.opacity = '0.6';
            
            try {
                const response = await fetch('/chick/api/folder/load', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ folder_path: folderPath })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    const images = result.data.images || [];
                    const loadedCount = result.data.loaded_count || 0;
                    const failedCount = result.data.failed_count || 0;
                    
                    if (images.length > 0) {
                        // 将加载的图片添加到存储中
                        images.forEach(img => {
                            // 检查是否已存在（避免重复）
                            const exists = imageStorage.some(existing => 
                                existing.name === img.name && 
                                Math.abs(existing.timestamp - img.timestamp) < 1000
                            );
                            if (!exists) {
                                imageStorage.push(img);
                            }
                        });
                        
                        // 渲染图片
                        renderImages();
                        // 保存到存储
                        debouncedSave();
                        
                        showTempNotification(
                            `✅ 成功加载 ${loadedCount} 张图片${failedCount > 0 ? `，${failedCount} 张失败` : ''}`
                        );
                    } else {
                        showWarningNotification('文件夹中没有找到图片文件');
                    }
                } else {
                    showWarningNotification(result.error || '加载失败');
                }
            } catch (error) {
                console.error('[Chick] 加载文件夹失败:', error);
                showWarningNotification('加载文件夹失败: ' + error.message);
            } finally {
                // 恢复按钮状态
                folderLoadBtn.disabled = false;
                folderLoadBtn.textContent = '📁 加载';
                folderLoadBtn.style.opacity = '1';
            }
        });
        
        // 支持回车键触发加载
        folderPathInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                folderLoadBtn.click();
            }
        });
    }
    
    // 绑定全选按钮事件
    document.getElementById('chick-select-all-btn').addEventListener('click', () => {
        if (selectedImages.length === imageStorage.length && imageStorage.length > 0) {
            // 如果已全选，则取消全选
            selectedImages = [];
        } else {
            // 全选所有图片
            selectedImages = imageStorage.map(img => img.id);
        }
        renderImages();
    });
    
    // 绑定删除选中按钮事件
    document.getElementById('chick-delete-selected-btn').addEventListener('click', () => {
        if (selectedImages.length === 0) {
            showWarningNotification('未选择任何内容');
            return;
        }
        
        const deleteCount = selectedImages.length;
        if (confirm(`确定要删除选中的 ${deleteCount} 张图片吗？`)) {
            imageStorage = imageStorage.filter(img => !isIdInArray(selectedImages, img.id));
            selectedImages = [];
            lastSelectedId = null;
            renderImages();
            // 删除操作立即保存，强制保存
            saveImages(true);
            showTempNotification(`✅ 已删除 ${deleteCount} 张图片`);
        }
    });
    
    // 绑定导出按钮事件
    document.getElementById('chick-export-btn').addEventListener('click', () => {
        if (selectedImages.length === 0) {
            showTempNotification('⚠️ 请先选择要导出的图片');
            return;
        }
        exportSelectedImages();
    });
    
    // 绑定保存按钮事件
    document.getElementById('chick-save-btn').addEventListener('click', async () => {
        if (selectedImages.length === 0) {
            showWarningNotification('未选择任何内容');
            return;
        }
        await saveSelectedImages();
    });
    
    // 初始化图片存储功能
    initImageStorage();
    
    // 如果已有图片数据，立即渲染
    if (imageStorage.length > 0) {
        renderImages();
    }
    
    // 更新列数
    updateColumns();
    
    // 添加窗口拖拽功能
    const titleBar = document.getElementById('chick-title-bar');
    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;
    
    titleBar.addEventListener('mousedown', (e) => {
        // 如果点击的是按钮或输入控件，不触发拖拽
        if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
        if (e.target.closest('#chick-thumb-size-control')) return;
        
        isDragging = true;
        dragOffsetX = e.clientX - browser.offsetLeft;
        dragOffsetY = e.clientY - browser.offsetTop;
        titleBar.style.cursor = 'grabbing';
        
        // 记录预览窗口相对于浏览器窗口的偏移
        const previewWindow = document.getElementById('chick-preview-window');
        if (previewWindow && previewWindow.style.display !== 'none') {
            const browserRect = browser.getBoundingClientRect();
            const previewRect = previewWindow.getBoundingClientRect();
            previewWindowOffsetX = previewRect.left - browserRect.right;
            previewWindowOffsetY = previewRect.top - browserRect.top;
        }
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const newLeft = e.clientX - dragOffsetX;
        const newTop = e.clientY - dragOffsetY;
        
        // 允许窗口移动到屏幕外
        browser.style.left = newLeft + 'px';
        browser.style.top = newTop + 'px';
        
        // 如果预览窗口显示，跟随移动
        const previewWindow = document.getElementById('chick-preview-window');
        if (previewWindow && previewWindow.style.display !== 'none') {
            const browserRect = browser.getBoundingClientRect();
            let previewLeft = browserRect.right + previewWindowOffsetX;
            let previewTop = browserRect.top + previewWindowOffsetY;
            
            // 如果预览窗口在右侧，检查是否需要调整到左侧
            const previewWidth = parseInt(previewWindow.style.width) || 400;
            if (previewWindowOffsetX > 0 && previewLeft + previewWidth > window.innerWidth - 20) {
                // 切换到左侧
                previewLeft = browserRect.left - previewWidth - 20;
            }
            
            // 确保不超出屏幕
            if (previewLeft < 20) previewLeft = 20;
            if (previewTop < 20) previewTop = 20;
            if (previewTop + (parseInt(previewWindow.style.height) || 400) > window.innerHeight - 20) {
                previewTop = window.innerHeight - (parseInt(previewWindow.style.height) || 400) - 20;
            }
            
            previewWindow.style.left = previewLeft + 'px';
            previewWindow.style.top = previewTop + 'px';
        }
    });
    
    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            titleBar.style.cursor = 'move';
        }
    });
    
    // 添加窗口缩放功能
    const resizeHandle = document.getElementById('chick-resize-handle');
    let isResizing = false;
    let resizeStartX = 0;
    let resizeStartY = 0;
    let resizeStartWidth = 0;
    let resizeStartHeight = 0;
    
    resizeHandle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        isResizing = true;
        resizeStartX = e.clientX;
        resizeStartY = e.clientY;
        resizeStartWidth = browser.offsetWidth;
        resizeStartHeight = browser.offsetHeight;
        document.body.style.cursor = 'nwse-resize';
        document.body.style.userSelect = 'none';
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        
        const deltaX = e.clientX - resizeStartX;
        const deltaY = e.clientY - resizeStartY;
        
        const newWidth = Math.max(300, Math.min(resizeStartWidth + deltaX, window.innerWidth - browser.offsetLeft));
        const newHeight = Math.max(200, Math.min(resizeStartHeight + deltaY, window.innerHeight - browser.offsetTop));
        
        browser.style.width = newWidth + 'px';
        browser.style.height = newHeight + 'px';
        
        // 如果预览窗口显示，更新其位置
        const previewWindow = document.getElementById('chick-preview-window');
        if (previewWindow && previewWindow.style.display !== 'none') {
            const browserRect = browser.getBoundingClientRect();
            let previewLeft = browserRect.right + previewWindowOffsetX;
            let previewTop = browserRect.top + previewWindowOffsetY;
            
            // 如果预览窗口在右侧，检查是否需要调整到左侧
            const previewWidth = parseInt(previewWindow.style.width) || 400;
            if (previewWindowOffsetX > 0 && previewLeft + previewWidth > window.innerWidth - 20) {
                // 切换到左侧
                previewLeft = browserRect.left - previewWidth - 20;
            }
            
            // 确保不超出屏幕
            if (previewLeft < 20) previewLeft = 20;
            if (previewTop < 20) previewTop = 20;
            if (previewTop + (parseInt(previewWindow.style.height) || 400) > window.innerHeight - 20) {
                previewTop = window.innerHeight - (parseInt(previewWindow.style.height) || 400) - 20;
            }
            
            previewWindow.style.left = previewLeft + 'px';
            previewWindow.style.top = previewTop + 'px';
        }
        
        // 更新列数
        updateColumns();
    });
    
    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            
            // 保存窗口大小
            saveWindowSize(browser.offsetWidth, browser.offsetHeight);
        }
    });
    
    // 监听窗口大小变化（使用ResizeObserver）
    const resizeObserver = new ResizeObserver(() => {
        updateColumns();
    });
    resizeObserver.observe(browser);
    
    // ESC键关闭，Delete键删除选中
    document.addEventListener('keydown', (e) => {
        const browser = document.getElementById('chick-browser');
        if (!browser || browser.style.display === 'none') return;
        
        const target = e.target;
        const isInputLike = target && (
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable
        );
        const isInsideBrowser = browser.contains(target);
        
        // 只要有选中图片，且焦点不在外部输入框，就允许 Delete 动作
        const allowDeleteBySelection = selectedImages.length > 0 && (!isInputLike || isInsideBrowser);
        const allowHandle = isInsideBrowser || allowDeleteBySelection;
        if (!allowHandle) return;
        
        if (e.key === 'Escape') {
            browser.style.display = 'none';
        } else if (e.key === 'Delete') {
            if (selectedImages.length === 0) return;
            e.preventDefault();
            const deleteCount = selectedImages.length;
            imageStorage = imageStorage.filter(img => !isIdInArray(selectedImages, img.id));
            selectedImages = [];
            lastSelectedId = null;
            renderImages();
            // 删除操作立即保存，强制保存
            saveImages(true);
            showTempNotification(`✅ 已删除 ${deleteCount} 张图片`);
        } else if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
            // Ctrl+A 仅在插件区域内使用，避免影响外部
            if (!isInsideBrowser) return;
            e.preventDefault();
            if (imageStorage.length > 0) {
                selectedImages = imageStorage.map(img => img.id);
                refreshSelectionStyles();
                updateButtonStates();
            }
        }
    });
}

// 初始化图片存储功能
function initImageStorage() {
    const content = document.getElementById('chick-content');
    if (!content) return;
    
    // 拖放功能
    content.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const dropZone = document.getElementById('chick-drop-zone');
        if (dropZone) {
            dropZone.style.display = 'flex';
        }
    });
    
    content.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const dropZone = document.getElementById('chick-drop-zone');
        if (dropZone) {
            dropZone.style.display = 'none';
        }
    });
    
    content.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const dropZone = document.getElementById('chick-drop-zone');
        if (dropZone) {
            dropZone.style.display = 'none';
        }
        
        // 只处理从外部拖入的文件（不是图片项的拖拽）
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const files = Array.from(e.dataTransfer.files);
            files.forEach(file => {
                if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
                    handleMediaFile(file);
                }
            });
        }
    });
    
    // 粘贴功能
    content.addEventListener('paste', (e) => {
        const items = Array.from(e.clipboardData.items);
        items.forEach(item => {
            if (item.type.startsWith('image/')) {
                const file = item.getAsFile();
                if (file) {
                    handleMediaFile(file);
                }
            }
        });
    });
    
    // 点击空白处取消选择
    content.addEventListener('click', (e) => {
        // 检查点击的是否是图片项或图片项内的元素
        const clickedImageItem = e.target.closest('.chick-image-item');
        if (!clickedImageItem) {
            // 点击的是空白处，取消所有选择
            selectedImages = [];
            lastSelectedId = null;
            refreshSelectionStyles();
            updateButtonStates();
        }
    });
    
    // 初始渲染
    renderImages();
}

// 处理媒体文件（图片/视频/文档）
function handleMediaFile(file) {
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');

    // 检查是否是文档类型
    const docExtensions = ['.txt', '.md', '.py', '.js', '.html', '.css', '.json', '.xml', '.doc', '.docx'];
    const fileName = file.name.toLowerCase();
    const isDoc = docExtensions.some(ext => fileName.endsWith(ext)) ||
                  file.type.includes('word') ||
                  file.type === 'application/msword' ||
                  file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    if (!isVideo && !isImage && !isDoc) return;

    if (isVideo && !SUPPORTED_VIDEO_TYPES.includes(file.type)) {
        showTempNotification('⚠️ 暂不支持该视频格式，仅支持 mp4/webm/mov');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        let mimeType = file.type;
        let mediaType = 'document';

        if (isVideo) {
            mediaType = 'video';
        } else if (isImage) {
            mediaType = 'image';
        } else if (fileName.endsWith('.docx') || file.type.includes('word')) {
            mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        } else if (fileName.endsWith('.doc')) {
            mimeType = 'application/msword';
        } else if (fileName.endsWith('.txt') || fileName.endsWith('.md') ||
                   fileName.endsWith('.py') || fileName.endsWith('.js') ||
                   fileName.endsWith('.html') || fileName.endsWith('.css') ||
                   fileName.endsWith('.json') || fileName.endsWith('.xml')) {
            mimeType = 'text/plain';
        }

        const mediaData = {
            id: Date.now() + Math.random(),
            name: file.name,
            size: file.size,
            dataUrl: e.target.result,
            timestamp: Date.now(),
            type: mediaType,
            mime: mimeType || 'application/octet-stream'
        };
        imageStorage.push(mediaData);
        // 先立即渲染，让用户看到
        renderImages();
        // 延迟保存，避免阻塞UI
        debouncedSave();
    };
    reader.readAsDataURL(file);
}

// 获取文档类型图标
function getDocIcon(fileName) {
    const name = fileName.toLowerCase();
    if (name.endsWith('.docx') || name.endsWith('.doc')) return '📄';
    if (name.endsWith('.txt')) return '📝';
    if (name.endsWith('.md')) return '📋';
    if (name.endsWith('.py')) return '🐍';
    if (name.endsWith('.js')) return '📜';
    if (name.endsWith('.html') || name.endsWith('.htm')) return '🌐';
    if (name.endsWith('.css')) return '🎨';
    if (name.endsWith('.json')) return '{ }';
    if (name.endsWith('.xml')) return '📑';
    return '📁';
}

// 格式化文件大小
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 缓存图片ID数组，避免重复查询DOM
let cachedImageIds = [];

// 渲染图片列表
function renderImages() {
    const container = document.getElementById('chick-images');
    if (!container) return;
    
    // 确保列数是最新的
    updateColumns();
    const thumbHeight = Math.min(Math.max(thumbnailSize, THUMBNAIL_SIZE_MIN), THUMBNAIL_SIZE_MAX);
    
    if (imageStorage.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 50px; color: #666;">
                <div style="font-size: 48px; margin-bottom: 15px;">📷</div>
                <p style="color: #888; margin-bottom: 10px;">拖入、粘贴或点击上传按钮上传图片</p>
                <p style="color: #666; font-size: 12px;">支持拖放、Ctrl+V粘贴</p>
            </div>
        `;
        cachedImageIds = [];
        return;
    }
    
    // 优化：只序列化必要的字段，避免序列化整个base64数据
    container.innerHTML = imageStorage.map((img, index) => {
        const isSelected = isIdInArray(selectedImages, img.id);
        // 只存储必要的元数据，不存储完整的base64（已通过dataUrl在img标签中）
        const imageMeta = {
            id: img.id,
            name: img.name,
            size: img.size,
            timestamp: img.timestamp,
            type: img.type || 'image',
            mime: img.mime,
            file_path: img.file_path
        };
        const isVideo = (img.type || 'image') === 'video';
        const isDocument = (img.type || 'image') === 'document';

        // 根据类型生成不同的缩略图
        let mediaContent;
        if (isDocument) {
            // 文档缩略图
            const docIcon = getDocIcon(img.name);
            const fileExt = img.name.split('.').pop().toUpperCase().substring(0, 5);
            mediaContent = `<div style="width: 100%; min-height: ${thumbHeight}px; max-height: ${thumbHeight}px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: linear-gradient(135deg, #2a2a4a 0%, #1e1e3a 100%); position: relative; color: #eee; font-size: 12px;">
                    <div style="text-align: center; pointer-events: none;">
                        <div style="font-size: 32px; margin-bottom: 6px;">${docIcon}</div>
                        <div style="max-width: 90%; word-break: break-all; opacity: 0.9; font-weight: 500;">${fileExt}</div>
                        <div style="max-width: 90%; word-break: break-all; opacity: 0.7; font-size: 10px; margin-top: 4px;">${escapeHtml(img.name || 'document')}</div>
                    </div>
                </div>`;
        } else if (isVideo) {
            mediaContent = `<div style="width: 100%; min-height: ${thumbHeight}px; max-height: ${thumbHeight}px; display: flex; align-items: center; justify-content: center; background: #111; position: relative; color: #eee; font-size: 12px;">
                    <div style="text-align: center; pointer-events: none;">
                        <div style="font-size: 32px; margin-bottom: 6px;">▶</div>
                        <div style="max-width: 90%; word-break: break-all; opacity: 0.85;">${escapeHtml(img.name || 'video')}</div>
                    </div>
                </div>`;
        } else {
            mediaContent = `<div style="width: 100%; min-height: ${thumbHeight}px; max-height: ${thumbHeight}px; display: flex; align-items: center; justify-content: center; background: #1e1e1e;">
                    <img src="${img.dataUrl}" style="max-width: 100%; max-height: ${thumbHeight}px; object-fit: contain; display: block; pointer-events: none;" />
                </div>`;
        }
        return `
        <div data-id="${img.id}" data-index="${index}" data-image='${JSON.stringify(imageMeta).replace(/'/g, "&#39;")}' draggable="true" style="position: relative; background: #2a2a2a; border-radius: 6px; overflow: hidden; cursor: pointer; display: flex; align-items: center; justify-content: center; border: ${isSelected ? '3px solid #4a90e2' : '3px solid transparent'}; transition: border-color 0.2s;" class="chick-image-item">
            ${mediaContent}
        </div>
        `;
    }).join('');
    
    // 更新缓存的ID数组
    cachedImageIds = imageStorage.map(img => img.id);
    
    // 只支持拖拽到画布，不支持容器内排序
    container.querySelectorAll('.chick-image-item').forEach((item) => {
        item.addEventListener('dragstart', (e) => {
            // 从imageStorage中获取完整数据，而不是从dataset解析
            const imgId = item.dataset.id; // 直接使用字符串ID，支持数字和字符串格式
            const imageData = imageStorage.find(img => String(img.id) === String(imgId));
            if (imageData) {
                e.dataTransfer.setData('application/json', JSON.stringify({
                    type: 'chick-image',
                    image: imageData,
                    itemId: imgId
                }));
            }
            e.dataTransfer.effectAllowed = 'copy';
            item.style.opacity = '0.5';
        });
        
        item.addEventListener('dragend', (e) => {
            item.style.opacity = '1';
        });
    });
    
    // 使用事件委托优化点击事件（只绑定一次，而不是每个元素都绑定）
    // 移除旧的事件监听器（如果存在）
    if (container._clickHandler) {
        container.removeEventListener('click', container._clickHandler);
    }
    
    // 创建新的事件处理函数
    container._clickHandler = async (e) => {
        const item = e.target.closest('.chick-image-item');
        if (!item) return;
        
        e.stopPropagation();
        const imgId = item.dataset.id; // 直接使用字符串ID，支持数字和字符串格式
        const currentIndex = parseInt(item.dataset.index) || cachedImageIds.findIndex(id => String(id) === String(imgId));
        const isShiftPressed = e.shiftKey;
        const isCtrlPressed = e.ctrlKey || e.metaKey;
        
        // 如果只是单击（没有按任何修饰键），显示预览（如果启用）
        if (!isShiftPressed && !isCtrlPressed) {
            // 如果在预览模式下，立即显示预览
            if (previewMode) {
                showPreviewImage(imgId, item);
                // 如果元数据面板是显示的，也更新元数据
                const metadataPanel = document.getElementById('chick-metadata-panel');
                if (metadataPanel && metadataPanel.style.display !== 'none') {
                    showImageMetadata(imgId);
                }
                // 注意：不return，让选择逻辑继续执行
            } else {
                // 非预览模式下，如果元数据面板已经打开，更新元数据
                const metadataPanel = document.getElementById('chick-metadata-panel');
                if (metadataPanel && metadataPanel.style.display !== 'none') {
                    showImageMetadata(imgId);
                }
            }
            // 注意：不再自动显示元数据面板
            // 元数据只在以下情况显示：
            // 1. 用户点击元数据按钮手动打开
            // 2. 元数据面板已经打开时，点击图片会更新元数据
        }
        
        if (isShiftPressed) {
            // Shift键：范围选择，从上次锚点到当前
            let anchorId = lastSelectedId;
            if (anchorId === null && selectedImages.length > 0) {
                anchorId = selectedImages[0];
            }
            
            if (anchorId === null) {
                // 无锚点时退化为单选
                selectedImages = [imgId];
            } else {
                // 使用字符串比较查找索引
                const anchorIndex = cachedImageIds.findIndex(id => String(id) === String(anchorId));
                if (anchorIndex !== -1) {
                    const start = Math.min(anchorIndex, currentIndex);
                    const end = Math.max(anchorIndex, currentIndex);
                    const rangeIds = cachedImageIds.slice(start, end + 1);
                    
                    if (isCtrlPressed) {
                        // Ctrl+Shift：合并范围
                        const set = new Set([...selectedImages, ...rangeIds]);
                        selectedImages = Array.from(set);
                    } else {
                        // 仅Shift：用范围替换
                        selectedImages = rangeIds;
                    }
                } else {
                    selectedImages = [imgId];
                }
            }
        } else {
            if (isCtrlPressed) {
                // Ctrl：单个开关 - 使用字符串比较
                const isSelected = selectedImages.some(id => String(id) === String(imgId));
                if (isSelected) {
                    selectedImages = selectedImages.filter(id => String(id) !== String(imgId));
                } else {
                    selectedImages = [...selectedImages, imgId];
                }
            } else {
                // 普通点击：单选/取消 - 使用字符串比较
                const isCurrentlySelected = selectedImages.length === 1 && String(selectedImages[0]) === String(imgId);
                if (isCurrentlySelected) {
                    selectedImages = [];
                } else {
                    selectedImages = [imgId];
                }
            }
            // 更新锚点
            lastSelectedId = imgId;
        }
        
        // Shift选择后更新锚点为当前项，便于连续范围选择
        if (isShiftPressed) {
            lastSelectedId = imgId;
        }
        
        // 使用requestAnimationFrame批量更新，避免重复重绘
        if (!container._pendingUpdate) {
            container._pendingUpdate = true;
            requestAnimationFrame(() => {
                refreshSelectionStyles();
                updateButtonStates();
                container._pendingUpdate = false;
            });
        }
    };
    
    // 绑定到容器上（事件委托）
    container.addEventListener('click', container._clickHandler);
    
    // 双击复制到剪贴板（也使用事件委托）
    if (container._dblclickHandler) {
        container.removeEventListener('dblclick', container._dblclickHandler);
    }
    
    container._dblclickHandler = async (e) => {
        const item = e.target.closest('.chick-image-item');
        if (!item) return;
        
        const img = item.querySelector('img');
        if (img) {
            try {
                const response = await fetch(img.src);
                const blob = await response.blob();
                await navigator.clipboard.write([
                    new ClipboardItem({ [blob.type]: blob })
                ]);
                showTempNotification('✅ 图片已复制到剪贴板');
            } catch (err) {
                console.error('复制失败:', err);
            }
        }
    };
    
    container.addEventListener('dblclick', container._dblclickHandler);
    
    // 更新按钮状态
    updateButtonStates();
}

// 缓存按钮元素，避免重复查询DOM
let cachedButtons = null;

// 更新按钮状态
function updateButtonStates() {
    // 只在第一次或按钮不存在时查询DOM
    if (!cachedButtons || !cachedButtons.deleteBtn) {
        cachedButtons = {
            deleteBtn: document.getElementById('chick-delete-selected-btn'),
            exportBtn: document.getElementById('chick-export-btn'),
            saveBtn: document.getElementById('chick-save-btn'),
            selectAllBtn: document.getElementById('chick-select-all-btn')
        };
    }
    
    const { deleteBtn, exportBtn, saveBtn, selectAllBtn } = cachedButtons;
    const selectedCount = selectedImages.length;
    const hasSelection = selectedCount > 0;
    
    if (deleteBtn) {
        if (hasSelection) {
            deleteBtn.disabled = false;
            deleteBtn.style.opacity = '1';
            deleteBtn.style.cursor = 'pointer';
            const newTitle = `删除选中(${selectedCount})`;
            if (deleteBtn.title !== newTitle) {
                deleteBtn.title = newTitle;
            }
        } else {
            deleteBtn.disabled = true;
            deleteBtn.style.opacity = '0.5';
            deleteBtn.style.cursor = 'not-allowed';
            if (deleteBtn.title !== '删除选中') {
                deleteBtn.title = '删除选中';
            }
        }
    }
    
    if (exportBtn) {
        if (hasSelection) {
            exportBtn.disabled = false;
            exportBtn.style.opacity = '1';
            exportBtn.style.cursor = 'pointer';
            const newTitle = `导出选中(${selectedCount})`;
            if (exportBtn.title !== newTitle) {
                exportBtn.title = newTitle;
            }
        } else {
            exportBtn.disabled = true;
            exportBtn.style.opacity = '0.5';
            exportBtn.style.cursor = 'not-allowed';
            if (exportBtn.title !== '导出选中') {
                exportBtn.title = '导出选中';
            }
        }
    }
    
    if (saveBtn) {
        if (hasSelection) {
            saveBtn.disabled = false;
            saveBtn.style.opacity = '1';
            saveBtn.style.cursor = 'pointer';
            const newTitle = `保存选中(${selectedCount})`;
            if (saveBtn.title !== newTitle) {
                saveBtn.title = newTitle;
            }
        } else {
            saveBtn.disabled = true;
            saveBtn.style.opacity = '0.5';
            saveBtn.style.cursor = 'not-allowed';
            if (saveBtn.title !== '保存选中') {
                saveBtn.title = '保存选中';
            }
        }
    }
    
    if (selectAllBtn && imageStorage.length > 0) {
        const newTitle = selectedImages.length === imageStorage.length ? '取消全选' : '全选';
        if (selectAllBtn.title !== newTitle) {
            selectAllBtn.title = newTitle;
        }
    }
}

// 仅更新当前渲染列表的选中样式，避免整列表重绘
function refreshSelectionStyles() {
    const container = document.getElementById('chick-images');
    if (!container) return;
    
    // 使用Set优化查找性能
    const selectedSet = new Set(selectedImages);
    
    // 使用DocumentFragment批量更新，减少重排
    const items = container.querySelectorAll('.chick-image-item');
    items.forEach(item => {
        const id = item.dataset.id; // 直接使用字符串ID，支持数字和字符串格式
        // 转换为字符串进行比较，确保类型一致
        const isSelected = Array.from(selectedSet).some(selectedId => String(selectedId) === String(id));
        const currentBorder = item.style.border;
        const newBorder = isSelected ? '3px solid #4a90e2' : '3px solid transparent';
        
        // 只在需要时更新样式，避免不必要的DOM操作
        if (currentBorder !== newBorder) {
            item.style.border = newBorder;
        }
    });
}

// 防抖保存函数（延迟保存，避免频繁保存）
function debouncedSave() {
    // 清除之前的定时器
    if (saveDebounceTimer) {
        clearTimeout(saveDebounceTimer);
    }
    
    // 如果正在保存，等待完成后再保存
    if (isSaving) {
        saveDebounceTimer = setTimeout(() => {
            debouncedSave();
        }, 500);
        return;
    }
    
    // 延迟1秒后保存（如果在这1秒内又有新图片上传，会重新计时）
    saveDebounceTimer = setTimeout(() => {
        saveImages();
    }, 1000);
}

// 统一保存函数（根据配置选择存储方式）
async function saveImages(force = false) {
    // 如果正在保存且不是强制保存，跳过
    if (isSaving && !force) {
        // 如果正在保存，等待完成后再次尝试
        setTimeout(() => {
            if (!isSaving) {
                saveImages(force);
            }
        }, 500);
        return;
    }
    
    if (imageStorage.length === 0) {
        // 如果没有图片，清除存储
        if (storageConfig.use_file_storage) {
            // 文件系统：删除索引文件
            try {
                const response = await fetch('/chick/api/storage/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ images: [] })
                });
            } catch (e) {
                console.error('[Chick] 清除文件存储失败:', e);
            }
        } else {
            // localStorage：删除数据
            try {
                localStorage.removeItem('chick-images');
                console.log('[Chick] 已清除空的本地存储');
            } catch (e) {
                console.error('[Chick] 清除本地存储失败:', e);
            }
        }
        return;
    }
    
    // 标记正在保存
    isSaving = true;
    
    try {
        if (storageConfig.use_file_storage) {
            // 异步保存，不阻塞UI
            saveToFileStorage().catch(e => {
                console.error('[Chick] 保存到文件系统失败，降级到localStorage:', e);
                saveToLocalStorage();
            }).finally(() => {
                isSaving = false;
            });
        } else {
            saveToLocalStorage();
            isSaving = false;
        }
    } catch (e) {
        console.error('[Chick] 保存失败:', e);
        isSaving = false;
    }
}

// 保存到本地存储
function saveToLocalStorage() {
    if (imageStorage.length === 0) {
        // 如果没有图片，清除存储
        try {
            localStorage.removeItem('chick-images');
            console.log('[Chick] 已清除空的本地存储');
        } catch (e) {
            console.error('[Chick] 清除本地存储失败:', e);
        }
        return;
    }
    
    try {
        const dataToSave = JSON.stringify(imageStorage);
        const sizeInMB = new Blob([dataToSave]).size / 1024 / 1024;
        
        // 检查大小限制（localStorage 通常限制在 5-10MB）
        if (sizeInMB > 4) {
            console.warn(`[Chick] 数据大小 ${sizeInMB.toFixed(2)}MB，可能超出 localStorage 限制`);
        }
        
        localStorage.setItem('chick-images', dataToSave);
        
        // 验证保存是否成功
        const saved = localStorage.getItem('chick-images');
        if (saved && saved === dataToSave) {
            console.log(`[Chick] ✅ 已成功保存 ${imageStorage.length} 张图片到本地存储 (${sizeInMB.toFixed(2)}MB)`);
        } else {
            console.error('[Chick] ❌ 保存验证失败，数据可能未正确保存');
            throw new Error('保存验证失败');
        }
    } catch (e) {
        console.error('[Chick] 保存失败:', e);
        if (e.name === 'QuotaExceededError' || e.code === 22 || e.message === '保存验证失败') {
            showTempNotification('⚠️ 存储空间不足，只保存最近1000张图片');
            // 尝试只保存最近的图片
            try {
                const recentImages = imageStorage.slice(-1000); // 只保存最近1000张
                const dataToSave = JSON.stringify(recentImages);
                localStorage.setItem('chick-images', dataToSave);
                
                // 验证保存
                const saved = localStorage.getItem('chick-images');
                if (saved && saved === dataToSave) {
                    console.log('[Chick] ✅ 已成功保存最近1000张图片');
                } else {
                    throw new Error('保存验证失败');
                }
            } catch (e2) {
                console.error('[Chick] 保存最近1000张图片失败:', e2);
                // 如果1000张还是太大，尝试更少的数量
                try {
                    const recentImages = imageStorage.slice(-100); // 只保存最近100张
                    const dataToSave = JSON.stringify(recentImages);
                    localStorage.setItem('chick-images', dataToSave);
                    
                    // 验证保存
                    const saved = localStorage.getItem('chick-images');
                    if (saved && saved === dataToSave) {
                        console.log('[Chick] ✅ 已成功保存最近100张图片');
                        showTempNotification('⚠️ 存储空间严重不足，只保存最近100张图片');
                    } else {
                        throw new Error('保存验证失败');
                    }
                } catch (e3) {
                    console.error('[Chick] 保存最近100张图片失败:', e3);
                    // 继续尝试更少的数量
                    try {
                        const recentImages = imageStorage.slice(-50); // 只保存最近50张
                        const dataToSave = JSON.stringify(recentImages);
                        localStorage.setItem('chick-images', dataToSave);
                        
                        const saved = localStorage.getItem('chick-images');
                        if (saved && saved === dataToSave) {
                            console.log('[Chick] ✅ 已成功保存最近50张图片');
                            showTempNotification('⚠️ 存储空间严重不足，只保存最近50张图片');
                        } else {
                            throw new Error('保存验证失败');
                        }
                    } catch (e4) {
                        console.error('[Chick] 保存最近50张图片也失败:', e4);
                        // 最后尝试保存10张
                        try {
                            const recentImages = imageStorage.slice(-10); // 只保存最近10张
                            const dataToSave = JSON.stringify(recentImages);
                            localStorage.setItem('chick-images', dataToSave);
                            
                            const saved = localStorage.getItem('chick-images');
                            if (saved && saved === dataToSave) {
                                console.log('[Chick] ✅ 已成功保存最近10张图片');
                                showTempNotification('⚠️ 存储空间极度不足，只保存最近10张图片');
                            } else {
                                throw new Error('保存验证失败');
                            }
                        } catch (e5) {
                            console.error('[Chick] ❌ 所有保存尝试都失败:', e5);
                            // 尝试清理其他可能占用空间的数据
                            try {
                                // 清理可能存在的旧数据
                                const keys = Object.keys(localStorage);
                                let cleared = false;
                                for (const key of keys) {
                                    if (key.startsWith('chick-') && key !== 'chick-images') {
                                        localStorage.removeItem(key);
                                        cleared = true;
                                    }
                                }
                                if (cleared) {
                                    console.log('[Chick] 已清理其他chick相关数据，重试保存...');
                                    // 重试保存最近10张
                                    const recentImages = imageStorage.slice(-10);
                                    localStorage.setItem('chick-images', JSON.stringify(recentImages));
                                    showTempNotification('⚠️ 已清理空间，只保存最近10张图片');
                                } else {
                                    showTempNotification('❌ 无法保存图片，浏览器存储空间已满。请清理浏览器缓存或使用更少的图片。');
                                }
                            } catch (e6) {
                                console.error('[Chick] ❌ 最终保存失败:', e6);
                                showTempNotification('❌ 无法保存图片，请检查浏览器存储空间。建议：1)清理浏览器缓存 2)减少图片数量 3)使用其他浏览器');
                            }
                        }
                    }
                }
            }
        } else {
            console.error('[Chick] 未知错误:', e);
            showTempNotification('❌ 保存图片时发生错误: ' + (e.message || '未知错误'));
        }
    }
}

// 加载配置
async function loadStorageConfig() {
    try {
        const response = await fetch('/chick/api/config');
        if (response.ok) {
            const result = await response.json();
            if (result.success && result.data) {
                storageConfig = {
                    use_file_storage: result.data.use_file_storage !== false,  // 默认启用文件存储
                    storage_dir: result.data.storage_dir || ''
                };
                console.log('[Chick] ✅ 配置加载成功:', storageConfig);
                return true;
            }
        }
    } catch (e) {
        console.warn('[Chick] 加载配置失败，使用默认配置:', e);
    }
    // 使用默认配置（启用文件存储）
    storageConfig = {
        use_file_storage: true,
        storage_dir: ''
    };
    return false;
}

// 保存到文件系统存储
async function saveToFileStorage() {
    try {
        const imagesToSave = imageStorage.map(img => ({
            id: img.id,
            name: img.name || `chick_${img.id}.${(img.type === 'video') ? 'mp4' : 'png'}`,
            dataUrl: img.dataUrl,
            size: img.size || 0,
            timestamp: img.timestamp || Date.now(),
            type: img.type || 'image',
            mime: img.mime,
            file_path: img.file_path
        }));

        const response = await fetch('/chick/api/storage/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ images: imagesToSave })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        if (result.success) {
            console.log(`[Chick] ✅ 已成功保存 ${result.data.saved_count} 张图片到文件系统`);
            if (result.data.failed_count > 0) {
                console.warn(`[Chick] ⚠️ ${result.data.failed_count} 张图片保存失败`);
            }
            // 回填文件路径等信息
            if (Array.isArray(result.data.saved_images)) {
                const mapById = new Map(result.data.saved_images.map(i => [String(i.id), i]));
                imageStorage = imageStorage.map(img => {
                    const saved = mapById.get(String(img.id));
                    if (saved) {
                        return {
                            ...img,
                            file_path: saved.file_path,
                            type: saved.type || img.type,
                            mime: saved.mime || img.mime
                        };
                    }
                    return img;
                });
            }
            return result.data;
        } else {
            throw new Error(result.error || '保存失败');
        }
    } catch (e) {
        console.error('[Chick] 保存到文件系统失败:', e);
        throw e;
    }
}

// 从文件系统加载
async function loadFromFileStorage() {
    try {
        const response = await fetch('/chick/api/storage/load');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        if (result.success && result.data) {
            const loadedImages = result.data;
            const loadedCount = loadedImages.length;
            console.log(`[Chick] 从文件系统读取到 ${loadedCount} 张图片`);

            // 验证数据完整性
            const beforeFilter = loadedImages.length;
            imageStorage = loadedImages.filter(img => {
                if (!img || !img.id) {
                    console.warn('[Chick] 发现无效的媒体数据（缺少id），已过滤');
                    return false;
                }
                if (!img.dataUrl || typeof img.dataUrl !== 'string') {
                    console.warn(`[Chick] 发现无效的媒体数据（id: ${img.id}，缺少dataUrl），已过滤`);
                    return false;
                }
                // 验证dataUrl格式：允许 image/* 或 video/*
                if (!img.dataUrl.startsWith('data:image/') && !img.dataUrl.startsWith('data:video/')) {
                    console.warn(`[Chick] 发现无效的媒体数据（id: ${img.id}，dataUrl格式错误），已过滤`);
                    return false;
                }
                // 填充类型信息
                if (!img.type) {
                    img.type = img.dataUrl.startsWith('data:video/') ? 'video' : 'image';
                }
                return true;
            });

            const filteredCount = beforeFilter - imageStorage.length;
            if (filteredCount > 0) {
                console.warn(`[Chick] 已过滤 ${filteredCount} 张无效图片`);
            }

            if (imageStorage.length > 0) {
                console.log(`[Chick] ✅ 成功从文件系统加载 ${imageStorage.length} 张有效图片`);
                // 如果过滤掉了图片，重新保存有效数据
                if (filteredCount > 0) {
                    console.log('[Chick] 正在保存清理后的数据...');
                    await saveToFileStorage();
                }
                return true;
            } else {
                console.log('[Chick] 文件系统中没有有效的图片数据');
                return false;
            }
        } else {
            console.log('[Chick] 文件系统中没有图片数据');
            return false;
        }
    } catch (e) {
        console.error('[Chick] ❌ 从文件系统加载失败:', e);
        return false;
    }
}

// 从本地存储加载
function loadFromLocalStorage() {
    try {
        const saved = localStorage.getItem('chick-images');
        if (saved) {
            const originalLength = saved.length;
            console.log(`[Chick] 从本地存储读取数据，大小: ${(originalLength / 1024 / 1024).toFixed(2)}MB`);
            
            imageStorage = JSON.parse(saved);
            const loadedCount = imageStorage.length;
            console.log(`[Chick] 已解析 ${loadedCount} 张图片数据`);
            
            // 验证数据完整性
            const beforeFilter = imageStorage.length;
            imageStorage = imageStorage.filter(img => {
                if (!img || !img.id) {
                    console.warn('[Chick] 发现无效的图片数据（缺少id），已过滤');
                    return false;
                }
                if (!img.dataUrl || typeof img.dataUrl !== 'string') {
                    console.warn(`[Chick] 发现无效的图片数据（id: ${img.id}，缺少dataUrl），已过滤`);
                    return false;
                }
                // 验证dataUrl格式
                if (!img.dataUrl.startsWith('data:image/')) {
                    console.warn(`[Chick] 发现无效的图片数据（id: ${img.id}，dataUrl格式错误），已过滤`);
                    return false;
                }
                return true;
            });
            
            const filteredCount = beforeFilter - imageStorage.length;
            if (filteredCount > 0) {
                console.warn(`[Chick] 已过滤 ${filteredCount} 张无效图片`);
            }
            
            if (imageStorage.length > 0) {
                console.log(`[Chick] ✅ 成功加载 ${imageStorage.length} 张有效图片`);
                // 如果过滤掉了图片，重新保存有效数据
                if (filteredCount > 0) {
                    console.log('[Chick] 正在保存清理后的数据...');
                    saveImages();
                }
            } else {
                console.warn('[Chick] ⚠️ 没有有效的图片数据');
            }
        } else {
            console.log('[Chick] 本地存储中没有图片数据');
        }
    } catch (e) {
        console.error('[Chick] ❌ 加载失败:', e);
        console.error('[Chick] 错误详情:', e.message, e.stack);
        
        // 尝试部分恢复数据
        try {
            const saved = localStorage.getItem('chick-images');
            if (saved && saved.length > 0) {
                console.log('[Chick] 尝试部分恢复数据...');
                // 尝试找到最后一个完整的JSON对象
                let lastValidIndex = saved.lastIndexOf('}');
                if (lastValidIndex > 0) {
                    const partialData = saved.substring(0, lastValidIndex + 1);
                    try {
                        const partial = JSON.parse(partialData);
                        if (Array.isArray(partial) && partial.length > 0) {
                            imageStorage = partial.filter(img => img && img.id && img.dataUrl);
                            console.log(`[Chick] ⚠️ 部分恢复 ${imageStorage.length} 张图片`);
                            // 保存恢复的数据
                            saveImages();
                            return;
                        }
                    } catch (e2) {
                        console.error('[Chick] 部分恢复也失败:', e2);
                    }
                }
            }
        } catch (e2) {
            console.error('[Chick] 恢复尝试失败:', e2);
        }
        
        // 如果恢复失败，清空可能有问题的数据
        try {
            localStorage.removeItem('chick-images');
            console.log('[Chick] 已清除可能有问题的本地存储数据');
        } catch (e2) {
            console.error('[Chick] 清除本地存储失败:', e2);
        }
        imageStorage = [];
    }
}

// 上传图片到ComfyUI并获取路径
async function uploadImageToComfyUI(imageData) {
    try {
        // 将base64转换为blob
        const response = await fetch(imageData.dataUrl);
        const blob = await response.blob();
        
        // 创建FormData
        const formData = new FormData();
        const fileName = imageData.name || `chick_${Date.now()}.png`;
        formData.append('image', blob, fileName);
        
        // 上传到ComfyUI（尝试多个可能的端点）
        let uploadResponse = null;
        const endpoints = ['/upload/image', '/upload', '/api/upload'];
        
        for (const endpoint of endpoints) {
            try {
                uploadResponse = await fetch(endpoint, {
                    method: 'POST',
                    body: formData
                });
                if (uploadResponse.ok) {
                    break;
                }
            } catch (e) {
                continue;
            }
        }
        
        if (uploadResponse && uploadResponse.ok) {
            const result = await uploadResponse.json();
            return result.name || result.filename || fileName;
        } else {
            // 如果上传失败，返回文件名（让ComfyUI尝试加载）
            return fileName;
        }
    } catch (error) {
        console.error('[Chick] 上传图片失败:', error);
        return imageData.name || `chick_${Date.now()}.png`;
    }
}

// 确保视频已落盘并返回路径
async function ensureVideoPath(mediaData) {
    if (mediaData.file_path) return mediaData.file_path;
    try {
        const payload = {
            images: [{
                id: mediaData.id,
                name: mediaData.name || `chick_${Date.now()}.mp4`,
                dataUrl: mediaData.dataUrl,
                size: mediaData.size || 0,
                timestamp: mediaData.timestamp || Date.now(),
                type: 'video',
                mime: mediaData.mime || 'video/mp4'
            }]
        };
        const resp = await fetch('/chick/api/storage/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (resp.ok) {
            const result = await resp.json();
            const savedList = result?.data?.saved_images || [];
            const saved = savedList.find(i => String(i.id) === String(mediaData.id)) || savedList[0];
            if (saved && saved.file_path) {
                mediaData.file_path = saved.file_path;
                mediaData.mime = saved.mime || mediaData.mime;
                mediaData.type = saved.type || 'video';
                // 同步回 imageStorage
                imageStorage = imageStorage.map(i => compareIds(i.id, mediaData.id) ? { ...mediaData } : i);
                return saved.file_path;
            }
        }
        console.warn('[Chick] 无法获取视频路径，响应异常');
    } catch (e) {
        console.error('[Chick] 获取视频路径失败:', e);
    }
    return null;
}

// 判断节点是否为加载图像相关节点
function isLoadImageNode(node) {
    if (!node) return false;
    const typeName = (node.type || node?.constructor?.type || node.title || '').toLowerCase();
    return typeName.includes('load') && typeName.includes('image');
}

// 将图片应用到已存在的加载节点（设置文件名和预览）
function applyImageToNode(node, imagePath, imageDataUrl) {
    if (!node) return;
    
    console.log('[Chick] 更新LoadImage节点:', { imagePath, nodeType: node.type, widgets: node.widgets?.map(w => w.name) });
    
    // 设置文件名属性
    if (node.properties) {
        node.properties.filename = imagePath;
    }
    
    // 尝试更新小部件的值 - 查找所有可能的图片widget
    let imageWidget = null;
    if (node.widgets && node.widgets.length > 0) {
        // 优先查找名为 'image' 的widget
        imageWidget = node.widgets.find(w => w.name === 'image');
        
        // 如果没有找到，查找其他可能的widget
        if (!imageWidget) {
            imageWidget = node.widgets.find(w => 
                w.name === 'filename' || 
                w.type === 'image' || 
                (w.name && w.name.toLowerCase().includes('image'))
            );
        }
        
        // 如果找到了widget，更新它
        if (imageWidget) {
            console.log('[Chick] 找到图片widget:', imageWidget.name, imageWidget.type);
            
            // 更新widget的值
            imageWidget.value = imagePath;
            
            // 如果widget有options属性（下拉选择），尝试更新options
            if (imageWidget.options && Array.isArray(imageWidget.options)) {
                // 确保图片路径在选项中
                if (!imageWidget.options.includes(imagePath)) {
                    imageWidget.options.unshift(imagePath);
                }
            }
            
            // 调用widget的callback
            if (imageWidget.callback) {
                try {
                    imageWidget.callback(imagePath);
                } catch (e) {
                    console.log('[Chick] widget callback执行失败:', e);
                }
            }
            
            // 如果widget有computeSize方法，调用它来更新尺寸
            if (imageWidget.computeSize) {
                try {
                    imageWidget.computeSize();
                } catch (e) {
                    // 忽略错误
                }
            }
        } else {
            console.log('[Chick] 未找到图片widget，尝试更新所有widget');
            // 如果没找到特定的widget，尝试更新所有widget
            for (let widget of node.widgets) {
                if (widget.type === 'image' || (widget.name && widget.name.toLowerCase().includes('image'))) {
                    widget.value = imagePath;
                    if (widget.callback) {
                        try {
                            widget.callback(imagePath);
                        } catch (e) {
                            console.log('[Chick] widget callback执行失败:', e);
                        }
                    }
                }
            }
        }
    }
    
    // 设置预览
    if (imageDataUrl) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            try {
                // 尝试多种方式设置预览图片
                if (node.setImage) {
                    node.setImage(img);
                }
                if (node.image !== undefined) {
                    node.image = img;
                }
                if (node.img !== undefined) {
                    node.img = img;
                }
                
                // 如果widget有setValue方法，尝试使用它
                if (imageWidget && imageWidget.setValue) {
                    try {
                        imageWidget.setValue(imagePath);
                    } catch (e) {
                        // 忽略错误
                    }
                }
                
                // 触发节点更新事件
                if (node.onConfigure) {
                    node.onConfigure();
                }
                if (node.onNodeCreated) {
                    node.onNodeCreated();
                }
                
                // 触发widget的onChanged事件
                if (imageWidget && imageWidget.onChanged) {
                    try {
                        imageWidget.onChanged(imagePath);
                    } catch (e) {
                        // 忽略错误
                    }
                }
                
                const app = getComfyApp();
                if (app && app.canvas && app.canvas.setDirty) {
                    app.canvas.setDirty(true);
                }
                
                // 强制重绘节点
                if (node.setDirtyCanvas) {
                    node.setDirtyCanvas(true);
                }
                
                console.log('[Chick] 图片预览已更新');
            } catch (e) {
                console.log('[Chick] 更新节点预览时出现警告（可忽略）:', e.message || e);
            }
        };
        img.onerror = () => {
            console.log('[Chick] 图片预览加载失败（不影响使用）');
        };
        img.src = imageDataUrl;
    }
    
    // 通知节点配置更新
    try {
        if (node.onConfigure) {
            node.onConfigure();
        }
        // 尝试触发节点的changed事件
        if (node.onNodeChanged) {
            node.onNodeChanged();
        }
    } catch (e) {
        console.log('[Chick] 节点配置更新时出现警告（可忽略）:', e.message || e);
    }
    
    // 标记画布为脏
    const app = getComfyApp();
    if (app && app.canvas && app.canvas.setDirty) {
        app.canvas.setDirty(true);
    }
    
    // 尝试触发节点的重绘
    if (node.setDirtyCanvas) {
        node.setDirtyCanvas(true);
    }
    
    // 如果节点有update方法，调用它
    if (node.update) {
        try {
            node.update();
        } catch (e) {
            // 忽略错误
        }
    }
}

// 创建LoadImage节点
function createLoadImageNode(imagePath, imageDataUrl, position) {
    const app = getComfyApp();
    if (!app || !app.graph) {
        showTempNotification('❌ ComfyUI未就绪');
        return null;
    }
    
    try {
        // 使用ComfyUI的方式创建节点
        let node = null;
        let nodeAddedToGraph = false; // 标记节点是否已经添加到图中
        
        // 方法1: 尝试使用app.graph.addNode（会自动添加到图中）
        if (app.graph.addNode) {
            try {
                node = app.graph.addNode('LoadImage');
                nodeAddedToGraph = true;
            } catch (e) {
                console.log('[Chick] addNode方法失败，尝试其他方法');
            }
        }
        
        // 方法2: 使用LiteGraph.createNode（需要手动添加）
        if (!node && window.LiteGraph) {
            try {
                node = LiteGraph.createNode('LoadImage');
            } catch (e) {
                // 尝试其他可能的节点名称
                const nodeTypes = ['Image Loader', 'Load Image', 'ImageLoader'];
                for (const nodeType of nodeTypes) {
                    try {
                        node = LiteGraph.createNode(nodeType);
                        if (node) break;
                    } catch (err) {
                        continue;
                    }
                }
            }
        }
        
        // 方法3: 从注册的节点类型中查找
        if (!node && window.LiteGraph && window.LiteGraph.registered_node_types) {
            for (const typeName in window.LiteGraph.registered_node_types) {
                const lowerName = typeName.toLowerCase();
                if ((lowerName.includes('load') && lowerName.includes('image')) || 
                    lowerName === 'loadimage' || 
                    lowerName === 'image loader') {
                    try {
                        node = LiteGraph.createNode(typeName);
                        if (node) break;
                    } catch (e) {
                        continue;
                    }
                }
            }
        }
        
        if (!node) {
            showTempNotification('❌ 无法创建LoadImage节点，请确保ComfyUI已加载');
            return null;
        }
        
        // 设置节点位置
        if (position) {
            node.pos = position;
        } else {
            // 获取画布中心位置
            const canvas = app.canvas;
            if (canvas && canvas.ds) {
                const canvasCenter = canvas.ds.visible_area;
                const x = (canvasCenter[0] + canvasCenter[2]) / 2;
                const y = (canvasCenter[1] + canvasCenter[3]) / 2;
                node.pos = [x - 100, y - 50];
            }
        }
        
        // 设置图片路径与预览
        if (imagePath || imageDataUrl) {
            applyImageToNode(node, imagePath, imageDataUrl);
        }
        
        // 如果节点还没有添加到图中，则添加
        if (!nodeAddedToGraph && app.graph && app.graph.add) {
            try {
                app.graph.add(node);
                nodeAddedToGraph = true;
            } catch (e) {
                // 静默处理添加节点时的错误，可能是ComfyUI内部的检查错误
                // 如果节点已经创建，即使添加失败也不影响使用
                console.log('[Chick] 添加节点到图时出现警告（可忽略）:', e.message || e);
            }
        }
        
        // 检查节点是否成功添加到图中
        const nodeInGraph = nodeAddedToGraph || (app.graph && app.graph._nodes && app.graph._nodes.includes(node));
        
        // 选中新创建的节点
        try {
            if (app.canvas && app.canvas.selectNode) {
                app.canvas.selectNode(node);
            }
        } catch (e) {
            // 静默处理选中节点错误
            console.log('[Chick] 选中节点时出现警告（可忽略）:', e.message || e);
        }
        
        // 触发画布重绘
        if (app.canvas && app.canvas.setDirty) {
            app.canvas.setDirty(true);
        }
        
        // 如果节点已成功创建（即使添加时有一些警告），返回节点
        // 只有在完全无法创建节点时才返回null
        return node;
    } catch (error) {
        // 只在真正无法创建节点时才显示错误
        const errorMsg = error.message || error.toString();
        // 过滤掉一些无用的内部错误信息
        if (errorMsg.includes('chick-image') || errorMsg.includes('Cannot create node')) {
            // 这些是ComfyUI内部的检查错误，节点可能已经创建成功，静默处理
            console.log('[Chick] ComfyUI内部检查警告（可忽略）:', errorMsg);
            return null;
        }
        // 其他真正的错误才显示
        console.error('[Chick] 创建节点失败:', error);
        showTempNotification('❌ 创建节点失败: ' + errorMsg);
        return null;
    }
}

// 创建VHS LoadVideo节点（ComfyUI-VideoHelperSuite）
function createLoadVideoNode(videoPath, position) {
    const app = getComfyApp();
    if (!app || !app.graph) {
        showTempNotification('❌ ComfyUI未就绪');
        return null;
    }
    
    const tryNodeTypes = ['VHS_LoadVideo', 'VHS LoadVideo', 'LoadVideo', 'Load Video', 'VHS_LoadVideo(upload)'];
    let node = null;
    let nodeAdded = false;
    
    for (const typeName of tryNodeTypes) {
        try {
            if (app.graph.addNode) {
                node = app.graph.addNode(typeName);
                nodeAdded = true;
            }
            if (!node && window.LiteGraph) {
                node = LiteGraph.createNode(typeName);
            }
        } catch (e) {
            node = null;
        }
        if (node) break;
    }
    
    if (!node) {
        showTempNotification('❌ 无法创建 VHS_LoadVideo 节点，请确认已安装 VideoHelperSuite');
        return null;
    }
    
    // 设置位置
    if (position) {
        node.pos = position;
    } else if (app.canvas && app.canvas.ds) {
        const area = app.canvas.ds.visible_area;
        const x = (area[0] + area[2]) / 2;
        const y = (area[1] + area[3]) / 2;
        node.pos = [x - 120, y - 40];
    }
    
    applyVideoToNode(node, videoPath);
    
    if (!nodeAdded && app.graph && app.graph.add) {
        try {
            app.graph.add(node);
        } catch (e) {
            console.log('[Chick] 添加VHS节点时提示（可忽略）:', e.message || e);
        }
    }
    
    return node;
}

function isLoadVideoNode(node) {
    if (!node || !node.type) return false;
    const t = node.type.toLowerCase();
    return t.includes('vhs_loadvideo') || t.includes('loadvideo') || t.includes('video loader') || t.includes('load video');
}

function applyVideoToNode(node, videoPath) {
    if (!node) return;
    // 尝试设置 widgets
    if (node.widgets) {
        node.widgets.forEach((w, idx) => {
            const name = (w.name || '').toLowerCase();
            if (name.includes('video') || name.includes('path') || name.includes('file')) {
                w.value = videoPath;
                if (node.widgets_values && node.widgets_values.length > idx) {
                    node.widgets_values[idx] = videoPath;
                }
            }
        });
    }
    // 有些节点使用properties
    if (node.properties) {
        const keys = ['video', 'path', 'file', 'filepath', 'video_path'];
        keys.forEach(k => {
            if (k in node.properties) {
                node.properties[k] = videoPath;
            }
        });
    }
    // 如果节点有特殊字段
    if (node.video) node.video = videoPath;
    if (node.path) node.path = videoPath;
    if (node.file) node.file = videoPath;
    
    if (node.setDirtyCanvas) node.setDirtyCanvas(true);
    if (node.update) {
        try { node.update(); } catch (e) {}
    }
    const app = getComfyApp();
    if (app && app.canvas && app.canvas.setDirty) {
        app.canvas.setDirty(true, true);
    }
}

// 保存选中的图片到本地
async function saveSelectedImages() {
    if (selectedImages.length === 0) {
        showWarningNotification('未选择任何内容');
        return;
    }
    
    const selectedData = imageStorage.filter(img => isIdInArray(selectedImages, img.id));
    
    // 检查是否支持 File System Access API
    if (window.showDirectoryPicker) {
        try {
            // 使用 File System Access API 选择保存目录
            const directoryHandle = await window.showDirectoryPicker({
                mode: 'readwrite'
            });
            
            let successCount = 0;
            let failCount = 0;
            
            for (const imgData of selectedData) {
                try {
                    // 将base64转换为blob
                    const response = await fetch(imgData.dataUrl);
                    const blob = await response.blob();
                    
                    // 生成文件名
                    const fileName = imgData.name || `chick_${imgData.id}.png`;
                    
                    // 创建文件句柄
                    const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
                    const writable = await fileHandle.createWritable();
                    await writable.write(blob);
                    await writable.close();
                    
                    successCount++;
                } catch (error) {
                    console.error(`保存文件 ${imgData.name} 失败:`, error);
                    failCount++;
                }
            }
            
            if (successCount > 0) {
                showTempNotification(`✅ 已保存 ${successCount} 张图片${failCount > 0 ? `，${failCount} 张失败` : ''}`);
            } else {
                showTempNotification(`❌ 保存失败`);
            }
        } catch (error) {
            // 用户取消了选择，或者API不可用
            if (error.name !== 'AbortError') {
                console.error('保存失败:', error);
                // 回退到传统下载方式
                downloadSelectedImages(selectedData);
            }
        }
    } else {
        // 不支持 File System Access API，使用传统下载方式
        downloadSelectedImages(selectedData);
    }
}

// 传统下载方式（逐个下载）
async function downloadSelectedImages(selectedData) {
    let successCount = 0;
    
    for (const imgData of selectedData) {
        try {
            // 将base64转换为blob
            const response = await fetch(imgData.dataUrl);
            const blob = await response.blob();
            
            // 创建下载链接
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = imgData.name || `chick_${imgData.id}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            // 释放URL对象
            setTimeout(() => URL.revokeObjectURL(url), 100);
            
            successCount++;
            
            // 延迟一下，避免浏览器阻止多个下载
            if (selectedData.length > 1) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        } catch (error) {
            console.error(`下载文件 ${imgData.name} 失败:`, error);
        }
    }
    
    if (successCount > 0) {
        showTempNotification(`✅ 已开始下载 ${successCount} 张图片`);
    }
}

// 将屏幕坐标转换为画布坐标
function screenToCanvas(app, screenX, screenY) {
    if (!app || !app.canvas || !app.canvas.canvas) {
        return [screenX, screenY];
    }
    
    const canvas = app.canvas.canvas;
    const rect = canvas.getBoundingClientRect();
    
    // 获取鼠标在画布元素上的相对位置
    const canvasX = screenX - rect.left;
    const canvasY = screenY - rect.top;
    
    // 转换为画布坐标
    if (app.canvas.ds) {
        const graphX = (canvasX / app.canvas.ds.scale) - app.canvas.ds.offset[0];
        const graphY = (canvasY / app.canvas.ds.scale) - app.canvas.ds.offset[1];
        return [graphX, graphY];
    }
    
    return [canvasX, canvasY];
}

// 导出选中的图片到画布
async function exportSelectedImages() {
    if (selectedImages.length === 0) {
        showTempNotification('⚠️ 请先选择要导出的图片');
        return;
    }
    
    const app = getComfyApp();
    if (!app || !app.graph) {
        showTempNotification('❌ ComfyUI未就绪');
        return;
    }
    
    const selectedData = imageStorage.filter(img => isIdInArray(selectedImages, img.id));
    let successCount = 0;
    
    // 计算节点位置：在弹出窗口旁边创建
    let startX = 100;
    let startY = 100;
    
    // 获取弹出窗口的位置和尺寸
    const browser = document.getElementById('chick-browser');
    if (browser && browser.style.display !== 'none') {
        const browserRect = browser.getBoundingClientRect();
        // 在窗口右侧创建节点，留出间距
        const screenX = browserRect.right + 20; // 窗口右侧 + 20px间距
        const screenY = browserRect.top + 50; // 窗口顶部 + 50px偏移（避开标题栏）
        
        // 转换为画布坐标
        const canvasPos = screenToCanvas(app, screenX, screenY);
        startX = canvasPos[0];
        startY = canvasPos[1];
    } else {
        // 如果窗口未显示，使用原来的逻辑：找到画布上最右侧的节点
        if (app.graph && app.graph._nodes && app.graph._nodes.length > 0) {
            // 找到所有节点的最右侧位置
            let maxX = -Infinity;
            let minY = Infinity;
            
            for (const node of app.graph._nodes) {
                if (node.pos && node.pos[0] !== undefined) {
                    const nodeX = node.pos[0];
                    const nodeY = node.pos[1];
                    // 估算节点宽度（通常LoadImage节点宽度约200-300px）
                    const estimatedNodeWidth = 250;
                    
                    if (nodeX + estimatedNodeWidth > maxX) {
                        maxX = nodeX + estimatedNodeWidth;
                    }
                    if (nodeY < minY) {
                        minY = nodeY;
                    }
                }
            }
            
            // 在最右侧创建新节点，留出间距
            if (maxX !== -Infinity) {
                startX = maxX + 50; // 在右侧留50px间距
                startY = minY !== Infinity ? minY : 100;
            }
        } else {
            // 如果没有现有节点，在左上角创建
            const canvas = app.canvas;
            if (canvas && canvas.ds) {
                const visibleArea = canvas.ds.visible_area;
                startX = visibleArea[0] + 50; // 可见区域左上角 + 50px
                startY = visibleArea[1] + 50;
            }
        }
    }
    
    let xOffset = 0;
    let yOffset = 0;
    
    for (let i = 0; i < selectedData.length; i++) {
        const imgData = selectedData[i];
        
        try {
            // 尝试上传图片
            let imagePath = await uploadImageToComfyUI(imgData);
            
            // 计算节点位置（横向排列）
            const position = [startX + xOffset, startY + yOffset];
            xOffset += 300; // 每个节点横向间距300px
            if (xOffset > 900) { // 超过900px换行
                xOffset = 0;
                yOffset += 250; // 每行纵向间距250px
            }
            
            // 创建节点
            const node = createLoadImageNode(imagePath, imgData.dataUrl, position);
            if (node) {
                successCount++;
            }
        } catch (error) {
            console.error('[Chick] 导出图片失败:', error);
        }
    }
    
    if (successCount > 0) {
        showTempNotification(`✅ 已导出 ${successCount} 张图片到画布`);
    } else {
        showTempNotification('❌ 导出失败');
    }
}

// 在指定画布坐标查找节点
function findNodeAtPosition(app, x, y) {
    if (!app || !app.graph) return null;
    
    // 优先使用LiteGraph提供的方法
    if (app.graph.getNodeOnPos) {
        try {
            const node = app.graph.getNodeOnPos(x, y, app.graph._nodes);
            if (node) {
                console.log('[Chick] 找到节点 (getNodeOnPos):', node.type, node.title);
                return node;
            }
        } catch (e) {
            // 忽略LiteGraph的异常，继续使用备用方案
            console.log('[Chick] getNodeOnPos失败，使用备用方案:', e);
        }
    }
    
    // 备用方案：手动遍历节点，使用更精确的尺寸计算
    if (app.graph._nodes && Array.isArray(app.graph._nodes)) {
        // 按z-index或创建时间倒序查找（后创建的节点在上层）
        const nodes = [...app.graph._nodes].reverse();
        
        for (const node of nodes) {
            if (!node || !node.pos) continue;
            
            const [nx, ny] = node.pos;
            
            // 尝试获取节点的实际尺寸
            let w = 200; // 默认宽度
            let h = 120; // 默认高度
            
            if (node.size && Array.isArray(node.size) && node.size.length >= 2) {
                [w, h] = node.size;
            } else if (node.computeSize) {
                try {
                    const computedSize = node.computeSize();
                    if (computedSize && Array.isArray(computedSize) && computedSize.length >= 2) {
                        [w, h] = computedSize;
                    }
                } catch (e) {
                    // 忽略计算错误
                }
            }
            
            // 检查坐标是否在节点范围内（增加一些容差）
            const tolerance = 5; // 5px容差
            if (x >= nx - tolerance && x <= nx + w + tolerance && 
                y >= ny - tolerance && y <= ny + h + tolerance) {
                console.log('[Chick] 找到节点 (手动查找):', node.type || node.title, { x, y, nx, ny, w, h });
                return node;
            }
        }
    }
    
    console.log('[Chick] 未找到节点:', { x, y });
    return null;
}

// 注册画布拖放监听
function registerCanvasDrop() {
    const app = getComfyApp();
    if (!app || !app.canvas || !app.canvas.canvas) {
        setTimeout(registerCanvasDrop, 1000);
        return;
    }
    
    const canvas = app.canvas.canvas;
    
    // 监听拖放事件
    canvas.addEventListener('dragover', function(e) {
        // 检查拖拽类型：支持chick-image数据和文件
        const hasJsonData = e.dataTransfer.types && e.dataTransfer.types.includes('application/json');
        const hasFiles = e.dataTransfer.types && Array.from(e.dataTransfer.types).some(type => type === 'Files' || type.startsWith('application/'));
        
        if (hasJsonData || hasFiles) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        }
    });
    
    canvas.addEventListener('drop', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        try {
            // 首先检查是否有文件（从外部文件系统拖拽）
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                const files = Array.from(e.dataTransfer.files);
                for (const file of files) {
                    // 检查是否是JSON工作流文件
                    if (file.type === 'application/json' || file.name.toLowerCase().endsWith('.json')) {
                        const reader = new FileReader();
                        reader.onload = async (event) => {
                            try {
                                const workflowData = JSON.parse(event.target.result);
                                await loadWorkflow(workflowData, file.name);
                            } catch (parseErr) {
                                console.error('[Chick] 解析JSON工作流失败:', parseErr);
                                showTempNotification('❌ 无法解析JSON工作流文件');
                            }
                        };
                        reader.readAsText(file);
                        return; // 处理JSON文件后返回
                    }
                    
                    if (file.type.startsWith('image/')) {
                        // 将文件转换为imageData格式
                        const reader = new FileReader();
                        reader.onload = async (event) => {
                            const imageData = {
                                id: Date.now() + Math.random(),
                                name: file.name,
                                dataUrl: event.target.result,
                                size: file.size,
                                timestamp: Date.now() / 1000
                            };
                            
                            // 检查图片中是否包含工作流元数据
                            const workflow = await extractWorkflowFromImage(imageData);
                            if (workflow) {
                                await loadWorkflow(workflow, file.name);
                            } else {
                                // 如果没有工作流，按普通图片处理
                                await handleCanvasDrop(imageData, e);
                            }
                        };
                        reader.readAsDataURL(file);
                        return; // 处理文件后返回，不继续处理JSON数据
                    }
                }
            }
            
            // 尝试从dataTransfer获取JSON数据（从chick-image拖拽）
            let data = null;
            try {
                data = e.dataTransfer.getData('application/json');
            } catch (err) {
                // 如果getData失败，尝试从items获取
                if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
                    for (let item of e.dataTransfer.items) {
                        if (item.type === 'application/json') {
                            item.getAsString((str) => {
                                try {
                                    const dragData = JSON.parse(str);
                                    if (dragData.type === 'chick-image' && dragData.image) {
                                        // 从窗口拖出的图片，直接按普通图片处理，不检测工作流
                                        handleCanvasDrop(dragData.image, e);
                                    }
                                } catch (parseErr) {
                                    console.error('[Chick] 解析拖拽数据失败:', parseErr);
                                }
                            });
                            return;
                        }
                    }
                }
            }
            
            if (data) {
                const dragData = JSON.parse(data);
                if (dragData.type === 'chick-image' && dragData.image) {
                    // 从窗口拖出的图片，直接按普通图片处理，不检测工作流
                    handleCanvasDrop(dragData.image, e);
                }
            }
        } catch (error) {
            console.error('[Chick] 拖放失败:', error);
        }
    });
    
    // 处理画布拖放
    async function handleCanvasDrop(imageData, e) {
        const canvas = app.canvas.canvas;
        
        // 获取鼠标在画布上的位置
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // 转换为画布坐标
        let position = null;
        if (app.canvas && app.canvas.ds) {
            const canvasX = (x / app.canvas.ds.scale) - app.canvas.ds.offset[0];
            const canvasY = (y / app.canvas.ds.scale) - app.canvas.ds.offset[1];
            position = [canvasX, canvasY];
        }
        
        // 检查当前位置是否命中已存在的LoadImage节点
        const targetNode = position ? findNodeAtPosition(app, position[0], position[1]) : null;
        
    const isVideo = (imageData.type || '').toString() === 'video' || (imageData.mime && imageData.mime.startsWith('video/')) || (imageData.dataUrl && imageData.dataUrl.startsWith('data:video/'));
        
        if (isVideo) {
            const videoPath = await ensureVideoPath(imageData);
            if (!videoPath) {
                showTempNotification('❌ 未找到视频文件路径，无法创建节点');
                return;
            }
            
            if (targetNode && isLoadVideoNode(targetNode)) {
                applyVideoToNode(targetNode, videoPath);
                showTempNotification(`✅ 已替换视频: ${imageData.name || '视频'}`);
                if (app.canvas && app.canvas.selectNode) {
                    try {
                        app.canvas.selectNode(targetNode);
                    } catch (err) {
                        console.log('[Chick] 选中节点时出现警告（可忽略）:', err.message || err);
                    }
                }
                return;
            }
            
            const node = createLoadVideoNode(videoPath, position);
            if (node) {
                const app = getComfyApp();
                const nodeInGraph = app && app.graph && app.graph._nodes && app.graph._nodes.includes(node);
                if (nodeInGraph) {
                    showTempNotification(`✅ 已添加视频: ${imageData.name || '视频'}`);
                }
            }
            return;
        }
        
        // 图片流程：上传后绑定LoadImage
        let imagePath = await uploadImageToComfyUI(imageData);
        
        if (targetNode && isLoadImageNode(targetNode)) {
            applyImageToNode(targetNode, imagePath, imageData.dataUrl);
            showTempNotification(`✅ 已替换节点图片: ${imageData.name || '图片'}`);
            
            if (app.canvas && app.canvas.selectNode) {
                try {
                    app.canvas.selectNode(targetNode);
                } catch (err) {
                    console.log('[Chick] 选中节点时出现警告（可忽略）:', err.message || err);
                }
            }
            return;
        }
        
        const node = createLoadImageNode(imagePath, imageData.dataUrl, position);
        if (node) {
            const app = getComfyApp();
            const nodeInGraph = app && app.graph && app.graph._nodes && app.graph._nodes.includes(node);
            if (nodeInGraph) {
                showTempNotification(`✅ 已添加图片: ${imageData.name || '图片'}`);
            }
        }
    }
}

// 从图片中提取工作流元数据
async function extractWorkflowFromImage(imageData) {
    try {
        // 调用后端API提取元数据
        const response = await fetch('/chick/api/metadata', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                image_data: imageData.dataUrl
            })
        });
        
        if (!response.ok) {
            return null;
        }
        
        const result = await response.json();
        if (result.success && result.data && result.data.comfy_workflow) {
            return result.data.comfy_workflow;
        }
        
        return null;
    } catch (error) {
        console.error('[Chick] 提取工作流元数据失败:', error);
        return null;
    }
}

// 加载工作流到ComfyUI
async function loadWorkflow(workflowData, fileName) {
    try {
        const app = getComfyApp();
        if (!app || !app.graph) {
            showTempNotification('❌ ComfyUI未就绪');
            return;
        }
        
        // 确保workflowData是对象格式
        let workflow = workflowData;
        if (typeof workflowData === 'string') {
            try {
                workflow = JSON.parse(workflowData);
            } catch (e) {
                showTempNotification('❌ 工作流数据格式错误');
                return;
            }
        }
        
        // 尝试使用ComfyUI的loadGraphData方法
        if (app.loadGraphData) {
            app.loadGraphData(workflow);
            showTempNotification(`✅ 已加载工作流: ${fileName || '工作流'}`);
            return;
        }
        
        // 如果loadGraphData不存在，尝试使用graph.load
        if (app.graph && app.graph.load) {
            app.graph.load(workflow);
            showTempNotification(`✅ 已加载工作流: ${fileName || '工作流'}`);
            return;
        }
        
        // 如果以上方法都不存在，尝试直接设置graph数据
        if (app.graph) {
            // 清空当前工作流
            if (app.graph.clear) {
                app.graph.clear();
            }
            
            // 加载新工作流
            if (app.graph.configure) {
                app.graph.configure(workflow);
            } else if (app.graph.fromJSON) {
                app.graph.fromJSON(workflow);
            } else {
                // 最后尝试直接设置
                Object.assign(app.graph, workflow);
            }
            
            // 触发重绘
            if (app.canvas && app.canvas.setDirty) {
                app.canvas.setDirty(true);
            }
            
            showTempNotification(`✅ 已加载工作流: ${fileName || '工作流'}`);
        } else {
            showTempNotification('❌ 无法加载工作流，ComfyUI API不可用');
        }
    } catch (error) {
        console.error('[Chick] 加载工作流失败:', error);
        showTempNotification('❌ 加载工作流失败: ' + (error.message || error));
    }
}

// 显示临时通知
function showTempNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #2a2a2a;
        color: white;
        padding: 12px 20px;
        border-radius: 6px;
        box-shadow: 0 5px 20px rgba(0,0,0,0.3);
        z-index: 10003;
        border-left: 4px solid #4a90e2;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 2000);
}

// 显示警告提示（未选择任何内容）
function showWarningNotification(message) {
    // 移除已存在的警告提示
    const existingWarning = document.getElementById('chick-warning-notification');
    if (existingWarning) {
        existingWarning.remove();
    }
    
    const warning = document.createElement('div');
    warning.id = 'chick-warning-notification';
    warning.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #3d3d2a;
        border: 1px solid #8b7355;
        border-radius: 8px;
        padding: 15px 20px;
        display: flex;
        align-items: center;
        gap: 12px;
        z-index: 10004;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8);
        min-width: 280px;
    `;
    
    warning.innerHTML = `
        <div style="
            width: 24px;
            height: 24px;
            flex-shrink: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #ffd700;
            font-size: 20px;
        ">⚠️</div>
        <div style="
            color: #ffd700;
            font-size: 14px;
            flex: 1;
        ">${message}</div>
        <button id="chick-warning-close" style="
            background: rgba(139, 92, 246, 0.3);
            border: none;
            border-radius: 6px;
            color: #ffd700;
            font-size: 18px;
            cursor: pointer;
            padding: 4px 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s;
            backdrop-filter: blur(10px);
        " onmouseover="this.style.background='rgba(139,92,246,0.5)'" onmouseout="this.style.background='rgba(139,92,246,0.3)'">✕</button>
    `;
    
    document.body.appendChild(warning);
    
    // 绑定关闭按钮事件
    const closeBtn = document.getElementById('chick-warning-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            warning.remove();
        });
    }
    
    // 3秒后自动关闭
    setTimeout(() => {
        if (warning.parentNode) {
            warning.remove();
        }
    }, 3000);
}

// 拦截ComfyUI的错误提示，过滤掉无用的"chick-image"错误
function interceptComfyUIErrors() {
    // 拦截可能的错误显示函数
    const originalAlert = window.alert;
    
    // 拦截alert（虽然ComfyUI通常不用alert）
    window.alert = function(message) {
        if (typeof message === 'string' && 
            (message.includes('chick-image') || 
             message.includes('无法创建节点') ||
             message.includes('Cannot create node'))) {
            // 静默处理这些错误
            console.log('[Chick] 已拦截ComfyUI错误提示:', message);
            return;
        }
        return originalAlert.apply(window, arguments);
    };
    
    // 延迟拦截ComfyUI的错误通知系统（等待ComfyUI加载完成）
    setTimeout(() => {
        // 尝试拦截ComfyUI的错误通知系统
        if (window.app && window.app.ui) {
            const originalShowError = window.app.ui.showError;
            if (originalShowError) {
                window.app.ui.showError = function(message) {
                    if (typeof message === 'string' && 
                        (message.includes('chick-image') || 
                         message.includes('无法创建节点') ||
                         message.includes('Cannot create node'))) {
                        // 静默处理这些错误
                        console.log('[Chick] 已拦截ComfyUI错误提示:', message);
                        return;
                    }
                    return originalShowError.apply(window.app.ui, arguments);
                };
            }
        }
        
        // 尝试拦截其他可能的错误显示方法
        if (window.LiteGraph && window.LiteGraph.onNodeError) {
            const originalOnNodeError = window.LiteGraph.onNodeError;
            window.LiteGraph.onNodeError = function(node, error) {
                if (error && (error.toString().includes('chick-image') || 
                    error.toString().includes('无法创建节点') ||
                    error.toString().includes('Cannot create node'))) {
                    console.log('[Chick] 已拦截LiteGraph节点错误:', error);
                    return;
                }
                return originalOnNodeError.apply(window.LiteGraph, arguments);
            };
        }
    }, 2000);
    
    // 监听可能的错误通知元素（更积极的拦截）
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1) { // Element node
                    // 检查是否是错误提示元素
                    const text = (node.textContent || node.innerText || '').toLowerCase();
                    if (text.includes('chick-image') || 
                        text.includes('无法创建节点') ||
                        text.includes('cannot create node')) {
                        // 立即隐藏
                        if (node.style) {
                            node.style.display = 'none';
                            node.style.visibility = 'hidden';
                            node.style.opacity = '0';
                            node.style.height = '0';
                            node.style.width = '0';
                            node.style.overflow = 'hidden';
                        }
                        // 立即移除
                        try {
                            if (node.parentNode) {
                                node.parentNode.removeChild(node);
                            }
                        } catch (e) {
                            // 忽略移除错误
                        }
                    }
                    
                    // 检查子元素
                    if (node.querySelectorAll) {
                        const errorElements = node.querySelectorAll('*');
                        errorElements.forEach((el) => {
                            const elText = (el.textContent || el.innerText || '').toLowerCase();
                            if (elText.includes('chick-image') || 
                                elText.includes('无法创建节点') ||
                                elText.includes('cannot create node')) {
                                if (el.style) {
                                    el.style.display = 'none';
                                    el.style.visibility = 'hidden';
                                }
                                try {
                                    if (el.parentNode) {
                                        el.parentNode.removeChild(el);
                                    }
                                } catch (e) {
                                    // 忽略移除错误
                                }
                            }
                        });
                    }
                }
            });
        });
    });
    
    // 开始观察body的变化
    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: false,
        characterData: false
    });
    
    // 也监听整个文档的变化（更全面）
    const docObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1) {
                    const text = (node.textContent || node.innerText || '').toLowerCase();
                    if (text.includes('chick-image') || 
                        text.includes('无法创建节点') ||
                        text.includes('cannot create node')) {
                        // 立即移除
                        try {
                            if (node.parentNode) {
                                node.parentNode.removeChild(node);
                            }
                        } catch (e) {
                            // 忽略移除错误
                        }
                    }
                }
            });
        });
    });
    
    // 观察整个文档
    docObserver.observe(document, {
        childList: true,
        subtree: true
    });
}

// 显示图片元数据
async function showImageMetadata(imageId) {
    // 使用字符串比较，支持数字和字符串类型的ID
    const imageData = imageStorage.find(img => compareIds(img.id, imageId));
    if (!imageData) return;
    
    const metadataPanel = document.getElementById('chick-metadata-panel');
    const metadataContent = document.getElementById('chick-metadata-content');
    const metadataToggleBtn = document.getElementById('chick-metadata-toggle-btn');
    
    if (!metadataPanel || !metadataContent) return;
    
    // 如果元数据面板隐藏，先显示它
    if (metadataPanel.style.display === 'none') {
        metadataPanel.style.display = 'block';
        if (metadataToggleBtn) {
            metadataToggleBtn.style.background = 'rgba(74, 144, 226, 0.6)';
            metadataToggleBtn.style.borderColor = 'rgba(74, 144, 226, 0.8)';
            metadataToggleBtn.innerHTML = '🔓'; // 开启状态：解锁图标
            metadataToggleBtn.title = '隐藏元数据';
        }
        saveMetadataPanelState(true);
    }
    
    // 显示加载状态
    metadataContent.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">正在加载元数据...</div>';
    
    try {
        // 调用API获取元数据
        const response = await fetch('/chick/api/metadata', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                image_data: imageData.dataUrl
            })
        });
        
        const result = await response.json();
        
        if (result.success && result.data) {
            const metadata = result.data;
            renderMetadata(metadata, metadataContent);
        } else {
            metadataContent.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">未找到元数据</div>';
        }
    } catch (error) {
        console.error('[Chick] 加载元数据失败:', error);
        metadataContent.innerHTML = '<div style="text-align: center; color: #e74c3c; padding: 20px;">加载元数据失败</div>';
    }
}

// 渲染元数据
function renderMetadata(metadata, container) {
    if (!metadata || Object.keys(metadata).length === 0) {
        container.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">未找到元数据</div>';
        return;
    }
    
    let html = '<div style="display: flex; flex-direction: column; gap: 12px;">';
    
    // 基本信息
    if (metadata.width || metadata.height) {
        html += `
            <div style="border-bottom: 1px solid #333; padding-bottom: 8px;">
                <div style="color: #4a90e2; font-weight: bold; margin-bottom: 6px;">📐 基本信息</div>
                <div style="color: #ccc; font-size: 11px; line-height: 1.8;">
                    ${metadata.width ? `宽度: ${metadata.width}px<br>` : ''}
                    ${metadata.height ? `高度: ${metadata.height}px<br>` : ''}
                    ${metadata.format ? `格式: ${metadata.format}<br>` : ''}
                    ${metadata.mode ? `模式: ${metadata.mode}<br>` : ''}
                    ${metadata.aspect_ratio ? `宽高比: ${metadata.aspect_ratio}` : ''}
                </div>
            </div>
        `;
    }
    
    // ComfyUI 模型信息
    if (metadata.comfy_models && Object.keys(metadata.comfy_models).length > 0) {
        html += `
            <div style="border-bottom: 1px solid #333; padding-bottom: 8px;">
                <div style="color: #4a90e2; font-weight: bold; margin-bottom: 6px;">🤖 ComfyUI 模型</div>
                <div style="color: #ccc; font-size: 11px; line-height: 1.8;">
        `;
        
        if (metadata.comfy_models.checkpoint) {
            html += `Checkpoint: <span style="color: #ffd700;">${metadata.comfy_models.checkpoint}</span><br>`;
        }
        if (metadata.comfy_models.unet_model) {
            html += `UNET: <span style="color: #ffd700;">${metadata.comfy_models.unet_model}</span><br>`;
        }
        if (metadata.comfy_models.clip_model) {
            html += `CLIP: <span style="color: #ffd700;">${metadata.comfy_models.clip_model}</span><br>`;
        }
        if (metadata.comfy_models.vae) {
            html += `VAE: <span style="color: #ffd700;">${metadata.comfy_models.vae}</span><br>`;
        }
        if (metadata.comfy_models.loras && metadata.comfy_models.loras.length > 0) {
            html += `LoRAs: `;
            metadata.comfy_models.loras.forEach((lora, idx) => {
                html += `<span style="color: #ffd700;">${lora.name}</span>`;
                if (lora.strength_model !== undefined || lora.strength_clip !== undefined) {
                    html += ` (${lora.strength_model || 1.0}, ${lora.strength_clip || 1.0})`;
                }
                if (idx < metadata.comfy_models.loras.length - 1) html += ', ';
            });
            html += '<br>';
        }
        if (metadata.comfy_models.controlnets && metadata.comfy_models.controlnets.length > 0) {
            html += `ControlNets: `;
            metadata.comfy_models.controlnets.forEach((cn, idx) => {
                html += `<span style="color: #ffd700;">${cn}</span>`;
                if (idx < metadata.comfy_models.controlnets.length - 1) html += ', ';
            });
            html += '<br>';
        }
        
        html += '</div></div>';
    }
    
    // ComfyUI 提示词
    if (metadata.comfy_prompts && Object.keys(metadata.comfy_prompts).length > 0) {
        html += `
            <div style="border-bottom: 1px solid #333; padding-bottom: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <div style="color: #4a90e2; font-weight: bold;">💬 ComfyUI 提示词</div>
                </div>
                <div style="color: #ccc; font-size: 11px; line-height: 1.8; max-height: 150px; overflow-y: auto;">
        `;
        
        for (const [key, prompt] of Object.entries(metadata.comfy_prompts)) {
            if (prompt.text) {
                const promptId = `chick-prompt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                // 显示节点类型和字段名
                const nodeLabel = prompt.type ? `${prompt.type}${prompt.field ? ` (${prompt.field})` : ''}` : '文本节点';
                html += `
                    <div style="margin-bottom: 8px; padding: 8px; background: rgba(74, 144, 226, 0.1); border-radius: 4px; word-break: break-word; position: relative;">
                        <div style="color: #888; font-size: 10px; margin-bottom: 4px; font-style: italic;">${escapeHtml(nodeLabel)}</div>
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                            <div style="flex: 1; color: #ccc; white-space: pre-wrap;">${escapeHtml(prompt.text)}</div>
                            <button class="chick-copy-prompt-btn" data-prompt-id="${promptId}" data-prompt-text="${escapeHtml(prompt.text).replace(/"/g, '&quot;')}" style="
                                background: rgba(74, 144, 226, 0.2);
                                border: 1px solid rgba(74, 144, 226, 0.4);
                                color: #4a90e2;
                                font-size: 11px;
                                cursor: pointer;
                                padding: 4px 8px;
                                border-radius: 4px;
                                transition: all 0.2s;
                                flex-shrink: 0;
                                white-space: nowrap;
                            " onmouseover="this.style.background='rgba(74,144,226,0.3)'; this.style.borderColor='rgba(74,144,226,0.6)'" onmouseout="this.style.background='rgba(74,144,226,0.2)'; this.style.borderColor='rgba(74,144,226,0.4)'">📋 复制</button>
                        </div>
                    </div>
                `;
            }
        }
        
        html += '</div></div>';
    }
    
    // A1111/Forge 参数
    if (metadata.parsed_params && Object.keys(metadata.parsed_params).length > 0) {
        html += `
            <div style="border-bottom: 1px solid #333; padding-bottom: 8px;">
                <div style="color: #4a90e2; font-weight: bold; margin-bottom: 6px;">⚙️ A1111/Forge 参数</div>
                <div style="color: #ccc; font-size: 11px; line-height: 1.8;">
        `;
        
        if (metadata.parsed_params.prompt) {
            const promptId = `chick-a1111-prompt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            html += `
                <div style="margin-bottom: 6px; display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                    <div style="flex: 1;">
                        <strong>提示词:</strong> <span style="color: #ffd700;">${escapeHtml(metadata.parsed_params.prompt)}</span>
                    </div>
                    <button class="chick-copy-prompt-btn" data-prompt-id="${promptId}" data-prompt-text="${escapeHtml(metadata.parsed_params.prompt).replace(/"/g, '&quot;')}" style="
                        background: rgba(74, 144, 226, 0.2);
                        border: 1px solid rgba(74, 144, 226, 0.4);
                        color: #4a90e2;
                        font-size: 11px;
                        cursor: pointer;
                        padding: 4px 8px;
                        border-radius: 4px;
                        transition: all 0.2s;
                        flex-shrink: 0;
                        white-space: nowrap;
                    " onmouseover="this.style.background='rgba(74,144,226,0.3)'; this.style.borderColor='rgba(74,144,226,0.6)'" onmouseout="this.style.background='rgba(74,144,226,0.2)'; this.style.borderColor='rgba(74,144,226,0.4)'">📋 复制</button>
                </div>
            `;
        }
        if (metadata.parsed_params.negative_prompt) {
            const negPromptId = `chick-a1111-neg-prompt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            html += `
                <div style="margin-bottom: 6px; display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                    <div style="flex: 1;">
                        <strong>负面提示词:</strong> <span style="color: #e74c3c;">${escapeHtml(metadata.parsed_params.negative_prompt)}</span>
                    </div>
                    <button class="chick-copy-prompt-btn" data-prompt-id="${negPromptId}" data-prompt-text="${escapeHtml(metadata.parsed_params.negative_prompt).replace(/"/g, '&quot;')}" style="
                        background: rgba(74, 144, 226, 0.2);
                        border: 1px solid rgba(74, 144, 226, 0.4);
                        color: #4a90e2;
                        font-size: 11px;
                        cursor: pointer;
                        padding: 4px 8px;
                        border-radius: 4px;
                        transition: all 0.2s;
                        flex-shrink: 0;
                        white-space: nowrap;
                    " onmouseover="this.style.background='rgba(74,144,226,0.3)'; this.style.borderColor='rgba(74,144,226,0.6)'" onmouseout="this.style.background='rgba(74,144,226,0.2)'; this.style.borderColor='rgba(74,144,226,0.4)'">📋 复制</button>
                </div>
            `;
        }
        if (metadata.ai_model) {
            html += `<div><strong>模型:</strong> <span style="color: #ffd700;">${escapeHtml(metadata.ai_model)}</span></div>`;
        }
        if (metadata.ai_vae) {
            html += `<div><strong>VAE:</strong> <span style="color: #ffd700;">${escapeHtml(metadata.ai_vae)}</span></div>`;
        }
        if (metadata.ai_sampler) {
            html += `<div><strong>采样器:</strong> ${escapeHtml(metadata.ai_sampler)}</div>`;
        }
        if (metadata.ai_steps) {
            html += `<div><strong>步数:</strong> ${metadata.ai_steps}</div>`;
        }
        if (metadata.ai_cfg) {
            html += `<div><strong>CFG Scale:</strong> ${metadata.ai_cfg}</div>`;
        }
        if (metadata.ai_seed) {
            html += `<div><strong>种子:</strong> ${metadata.ai_seed}</div>`;
        }
        if (metadata.ai_loras && metadata.ai_loras.length > 0) {
            html += `<div><strong>LoRAs:</strong> `;
            metadata.ai_loras.forEach((lora, idx) => {
                html += `<span style="color: #ffd700;">${escapeHtml(lora.name)}</span> (${lora.weight})`;
                if (idx < metadata.ai_loras.length - 1) html += ', ';
            });
            html += '</div>';
        }
        
        html += '</div></div>';
    }
    
    // EXIF 信息
    if (metadata.exif_info && Object.keys(metadata.exif_info).length > 0) {
        html += `
            <div style="border-bottom: 1px solid #333; padding-bottom: 8px;">
                <div style="color: #4a90e2; font-weight: bold; margin-bottom: 6px;">📷 EXIF 信息</div>
                <div style="color: #ccc; font-size: 11px; line-height: 1.8; max-height: 150px; overflow-y: auto;">
        `;
        
        for (const [key, value] of Object.entries(metadata.exif_info)) {
            if (value !== null && value !== undefined) {
                html += `<div><strong>${escapeHtml(key)}:</strong> ${escapeHtml(String(value))}</div>`;
            }
        }
        
        html += '</div></div>';
    }
    
    // 其他元数据
    const otherKeys = Object.keys(metadata).filter(key => 
        !['width', 'height', 'format', 'mode', 'aspect_ratio', 
          'comfy_models', 'comfy_prompts', 'comfy_prompt', 'comfy_workflow', 
          'parsed_params', 'exif_info', 'ai_model', 'ai_vae', 'ai_sampler', 
          'ai_steps', 'ai_cfg', 'ai_seed', 'ai_loras'].includes(key)
    );
    
    if (otherKeys.length > 0) {
        html += `
            <div style="border-bottom: 1px solid #333; padding-bottom: 8px;">
                <div style="color: #4a90e2; font-weight: bold; margin-bottom: 6px;">📝 其他信息</div>
                <div style="color: #ccc; font-size: 11px; line-height: 1.8;">
        `;
        
        for (const key of otherKeys) {
            const value = metadata[key];
            if (value !== null && value !== undefined) {
                html += `<div><strong>${escapeHtml(key)}:</strong> ${escapeHtml(String(value))}</div>`;
            }
        }
        
        html += '</div></div>';
    }
    
    html += '</div>';
    container.innerHTML = html;
    
    // 绑定复制按钮事件
    container.querySelectorAll('.chick-copy-prompt-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const promptText = btn.getAttribute('data-prompt-text');
            if (promptText) {
                try {
                    await navigator.clipboard.writeText(promptText);
                    // 更新按钮文本显示复制成功
                    const originalText = btn.textContent;
                    btn.textContent = '✅ 已复制';
                    btn.style.background = 'rgba(76, 175, 80, 0.3)';
                    btn.style.borderColor = 'rgba(76, 175, 80, 0.6)';
                    btn.style.color = '#4caf50';
                    
                    // 2秒后恢复
                    setTimeout(() => {
                        btn.textContent = originalText;
                        btn.style.background = 'rgba(74, 144, 226, 0.2)';
                        btn.style.borderColor = 'rgba(74, 144, 226, 0.4)';
                        btn.style.color = '#4a90e2';
                    }, 2000);
                    
                    showTempNotification('✅ 提示词已复制到剪贴板');
                } catch (err) {
                    console.error('[Chick] 复制失败:', err);
                    // 降级方案：使用传统方法
                    try {
                        const textArea = document.createElement('textarea');
                        textArea.value = promptText;
                        textArea.style.position = 'fixed';
                        textArea.style.opacity = '0';
                        document.body.appendChild(textArea);
                        textArea.select();
                        document.execCommand('copy');
                        document.body.removeChild(textArea);
                        showTempNotification('✅ 提示词已复制到剪贴板');
                    } catch (fallbackErr) {
                        showTempNotification('❌ 复制失败，请手动复制');
                    }
                }
            }
        });
    });
}

// HTML转义函数
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 切换元数据面板显示/隐藏
function toggleMetadataPanel() {
    const metadataPanel = document.getElementById('chick-metadata-panel');
    const toggleBtn = document.getElementById('chick-metadata-toggle-btn');
    
    if (!metadataPanel || !toggleBtn) return;
    
    const isVisible = metadataPanel.style.display !== 'none';
    
    if (isVisible) {
        metadataPanel.style.display = 'none';
        toggleBtn.style.background = 'rgba(255, 255, 255, 0.15)';
        toggleBtn.style.borderColor = 'rgba(255, 255, 255, 0.3)';
        toggleBtn.innerHTML = '🔑'; // 关闭状态：锁图标
        toggleBtn.title = '显示元数据';
        saveMetadataPanelState(false);
    } else {
        metadataPanel.style.display = 'block';
        toggleBtn.style.background = 'rgba(74, 144, 226, 0.6)';
        toggleBtn.style.borderColor = 'rgba(74, 144, 226, 0.8)';
        toggleBtn.innerHTML = '🔓'; // 开启状态：解锁图标
        toggleBtn.title = '隐藏元数据';
        saveMetadataPanelState(true);
    }
}

// 切换预览模式
function togglePreviewMode() {
    previewMode = !previewMode;
    const previewModeBtn = document.getElementById('chick-preview-mode-btn');
    
    if (!previewModeBtn) return;
    
    if (previewMode) {
        previewModeBtn.style.background = 'rgba(74, 144, 226, 0.6)';
        previewModeBtn.style.borderColor = 'rgba(74, 144, 226, 0.8)';
        previewModeBtn.innerHTML = '👁️'; // 开启状态：眼睛图标
        previewModeBtn.title = '关闭预览模式';
        showTempNotification('🔍 预览模式已开启，点击图片查看大图');
        
        // 如果已经有选中的图片，立即显示预览
        if (selectedImages.length > 0) {
            const firstSelectedId = selectedImages[0];
            const container = document.getElementById('chick-images');
            if (container) {
                const item = container.querySelector(`[data-id="${firstSelectedId}"]`);
                if (item) {
                    // 立即显示预览（previewMode已经在上面设置为true）
                    showPreviewImage(firstSelectedId, item);
                }
            }
        }
    } else {
        previewModeBtn.style.background = 'rgba(255, 255, 255, 0.15)';
        previewModeBtn.style.borderColor = 'rgba(255, 255, 255, 0.3)';
        previewModeBtn.innerHTML = '👁️‍🗨️'; // 关闭状态：闭眼图标
        previewModeBtn.title = '放大预览模式';
        // 关闭预览窗口
        const previewWindow = document.getElementById('chick-preview-window');
        if (previewWindow) {
            previewWindow.style.display = 'none';
        }
        showTempNotification('🔍 预览模式已关闭');
    }
}

// 显示预览媒体（图片、视频或文档）
function showPreviewImage(imageId, imageElement) {
    if (!previewMode) return;
    
    // 使用字符串比较，支持数字和字符串类型的ID
    const imageData = imageStorage.find(img => compareIds(img.id, imageId));
    if (!imageData) return;
    
    const previewWindow = document.getElementById('chick-preview-window');
    const previewImage = document.getElementById('chick-preview-image');
    const previewVideo = document.getElementById('chick-preview-video');
    const previewDocument = document.getElementById('chick-preview-document');
    
    if (!previewWindow || !previewImage || !previewVideo || !previewDocument) return;
    
    // 如果预览窗口已经显示，先隐藏图片避免闪烁
    const wasVisible = previewWindow.style.display !== 'none';
    if (wasVisible) {
        previewImage.style.opacity = '0';
    }
    
    const isVideo = (imageData.type || (imageData.mime && imageData.mime.startsWith('video/')) || '').toString().includes('video') 
        || (imageData.dataUrl && imageData.dataUrl.startsWith('data:video/'));
    
    const isDocument = (imageData.type || 'image') === 'document' || 
                       (imageData.mime && (
                           imageData.mime.includes('text/') || 
                           imageData.mime.includes('word') ||
                           imageData.name?.toLowerCase().endsWith('.docx') ||
                           imageData.name?.toLowerCase().endsWith('.doc') ||
                           imageData.name?.toLowerCase().endsWith('.txt') ||
                           imageData.name?.toLowerCase().endsWith('.md')
                       ));
    
    // 重置显示状态
    previewImage.style.display = 'none';
    previewVideo.style.display = 'none';
    previewDocument.style.display = 'none';
    
    const maxWidth = Math.min(window.innerWidth * 0.4, 800);
    const maxHeight = Math.min(window.innerHeight * 0.7, 800);
    const minWidth = 300;
    const minHeight = 200;
    
    const updateLayout = (mediaWidth, mediaHeight) => {
        const imgAspectRatio = mediaWidth / mediaHeight;
        const maxAspectRatio = maxWidth / maxHeight;
        let previewWidth, previewHeight;
        
        if (imgAspectRatio > maxAspectRatio) {
            previewWidth = Math.min(mediaWidth, maxWidth);
            previewWidth = Math.max(previewWidth, minWidth);
            previewHeight = previewWidth / imgAspectRatio;
            if (previewHeight > maxHeight) {
                previewHeight = maxHeight;
                previewWidth = previewHeight * imgAspectRatio;
            }
        } else {
            previewHeight = Math.min(mediaHeight, maxHeight);
            previewHeight = Math.max(previewHeight, minHeight);
            previewWidth = previewHeight * imgAspectRatio;
            if (previewWidth > maxWidth) {
                previewWidth = maxWidth;
                previewHeight = previewWidth / imgAspectRatio;
            }
        }
        
        // 加上内边距（标题栏高度 + padding）
        const headerHeight = 50;
        previewHeight = previewHeight + headerHeight;
        
        // 计算预览窗口位置
        let left = 20;
        let top = 20;
        
        const browser = document.getElementById('chick-browser');
        if (browser) {
            const browserRect = browser.getBoundingClientRect();
            
            // 计算预览窗口位置（在浏览器窗口右侧）
            left = browserRect.right + 20;
            top = browserRect.top;
            
            // 如果右侧空间不足，显示在左侧
            if (left + previewWidth > window.innerWidth - 20) {
                left = browserRect.left - previewWidth - 20;
            }
            
            // 确保不超出屏幕
            if (left < 20) left = 20;
            if (top + previewHeight > window.innerHeight - 20) {
                top = window.innerHeight - previewHeight - 20;
            }
            if (top < 20) top = 20;
        }
        
        // 使用requestAnimationFrame平滑更新尺寸，避免闪烁
        requestAnimationFrame(() => {
            // 设置预览窗口位置和大小
            previewWindow.style.left = left + 'px';
            previewWindow.style.top = top + 'px';
            previewWindow.style.width = previewWidth + 'px';
            previewWindow.style.height = previewHeight + 'px';
            
            // 显示媒体（淡入效果）
            if (isVideo) {
                previewVideo.style.display = 'block';
                previewVideo.style.opacity = '1';
            } else if (isDocument) {
                previewDocument.style.display = 'block';
                previewDocument.style.opacity = '1';
            } else {
                previewImage.style.display = 'block';
                previewImage.style.opacity = '1';
            }
            
            // 计算并存储预览窗口相对于浏览器窗口的偏移量（用于跟随移动）
            const browserEl = document.getElementById('chick-browser');
            if (browserEl) {
                const browserRect = browserEl.getBoundingClientRect();
                previewWindowOffsetX = left - browserRect.right;
                previewWindowOffsetY = top - browserRect.top;
            }
        });
    };
    
    if (isVideo) {
        previewVideo.src = imageData.dataUrl;
        previewVideo.currentTime = 0;
        previewVideo.onloadedmetadata = () => {
            const videoWidth = previewVideo.videoWidth || 640;
            const videoHeight = previewVideo.videoHeight || 360;
            updateLayout(videoWidth, videoHeight);
            previewVideo.play().catch(() => {});
        };
    } else if (isDocument) {
        // 解析文档内容
        const fileExt = '.' + (imageData.name?.toLowerCase().split('.').pop() || '');
        let docTitle = imageData.name || '文档预览';

        // 显示加载状态
        previewDocument.innerHTML = `<div style="font-size: 14px; font-weight: bold; margin-bottom: 10px; color: #4a90e2;">${escapeHtml(docTitle)}</div>` +
                                   `<div style="text-align: center; padding: 20px;">
                                      <div style="display: inline-block; width: 30px; height: 30px; border: 3px solid #333; border-top: 3px solid #4a90e2; border-radius: 50%; animation: spin 1s linear infinite; vertical-align: middle;"></div>
                                      <span style="margin-left: 10px;">正在加载文档内容...</span>
                                    </div>`;

        // 调用后端 API 获取文档内容
        fetch('/chick/api/document/content', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                document_data: imageData.dataUrl,
                extension: fileExt
            })
        })
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                // 检查是否是 DOC 旧版格式
                if (result.format === 'doc_legacy' || result.is_ole_binary) {
                    previewDocument.innerHTML = `
                        <div style="display: flex; align-items: center; margin-bottom: 15px;">
                            <div style="font-size: 32px; margin-right: 10px;">📄</div>
                            <div>
                                <div style="font-size: 16px; font-weight: bold; color: #4a90e2;">${escapeHtml(docTitle)}</div>
                                <div style="color: #888; font-size: 12px;">${result.file_size_readable || 'DOC 文档'}</div>
                            </div>
                        </div>
                        <div style="background: linear-gradient(135deg, rgba(231, 76, 60, 0.1) 0%, rgba(231, 76, 60, 0.05) 100%); border: 1px solid rgba(231, 76, 60, 0.3); border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                            <div style="color: #e74c3c; font-weight: bold; margin-bottom: 10px; display: flex; align-items: center;">
                                <span style="margin-right: 8px;">⚠️</span> ${result.is_ole_binary ? '旧版 DOC 格式无法预览' : '无法预览此文档'}
                            </div>
                            <div style="color: #ddd; font-size: 13px; line-height: 1.8; white-space: pre-wrap; font-family: inherit;">${escapeHtml(result.content)}</div>
                        </div>
                        <div style="background: rgba(74, 144, 226, 0.1); border: 1px solid rgba(74, 144, 226, 0.3); border-radius: 8px; padding: 15px;">
                            <div style="color: #4a90e2; font-weight: bold; margin-bottom: 8px;">💡 快速解决方案</div>
                            <div style="color: #ccc; font-size: 13px; line-height: 1.8;">
                                <div>1. 用 Microsoft Word 打开 → <b>文件 → 另存为 → DOCX</b></div>
                                <div style="margin-top: 8px;">2. 或使用在线转换：</div>
                                <div style="margin-left: 10px; color: #888;">• cloudconvert.com/doc-to-docx</div>
                                <div style="margin-left: 10px; color: #888;">• convertio.co/doc-docx/</div>
                            </div>
                        </div>
                    `;
                    updateLayout(450, 400);
                    return;
                }

                let contentHtml = `<div style="font-size: 14px; font-weight: bold; margin-bottom: 10px; color: #4a90e2;">${escapeHtml(docTitle)}</div>`;

                // 添加文档信息
                if (result.file_size_readable) {
                    contentHtml += `<div style="color: #888; font-size: 12px; margin-bottom: 10px;">文件大小: ${result.file_size_readable}</div>`;
                }

                // 添加段落/字数统计
                if (result.paragraph_count) {
                    contentHtml += `<div style="color: #888; font-size: 12px; margin-bottom: 10px;">段落: ${result.paragraph_count} | 字数: ${result.word_count || '-'}</div>`;
                }

                contentHtml += `<div style="border-top: 1px solid #333; margin: 10px 0;"></div>`;
                contentHtml += `<div style="white-space: pre-wrap; word-wrap: break-word; font-family: 'Consolas', 'Monaco', 'Courier New', monospace; font-size: 13px; line-height: 1.6; color: #ddd;">${escapeHtml(result.content || '无内容')}</div>`;

                // 如果有表格，添加到末尾
                if (result.tables) {
                    contentHtml += `<div style="border-top: 1px solid #333; margin: 15px 0;"></div>`;
                    contentHtml += `<div style="font-weight: bold; color: #4a90e2; margin-bottom: 10px;">表格内容:</div>`;
                    contentHtml += `<div style="white-space: pre-wrap; word-wrap: break-word; font-family: 'Consolas', 'Monaco', 'Courier New', monospace; font-size: 13px; line-height: 1.6; color: #ddd;">${escapeHtml(result.tables)}</div>`;
                }

                // 如果被截断，显示提示
                if (result.truncated) {
                    contentHtml += `<div style="border-top: 1px solid #333; margin: 15px 0;"></div>`;
                    contentHtml += `<div style="color: #ff9800; font-size: 12px;">⚠️ 内容已截断显示（仅显示前 100KB）</div>`;
                }

                previewDocument.innerHTML = contentHtml;
                updateLayout(500, 400);
            } else {
                // 显示错误信息
                previewDocument.innerHTML = `<div style="font-size: 14px; font-weight: bold; margin-bottom: 10px; color: #e74c3c;">${escapeHtml(docTitle)}</div>` +
                                           `<div style="color: #e74c3c; white-space: pre-wrap; word-wrap: break-word;">${escapeHtml(result.content || result.error || '无法预览此文档')}</div>`;
                updateLayout(400, 300);
            }
        })
        .catch(error => {
            previewDocument.innerHTML = `<div style="font-size: 14px; font-weight: bold; margin-bottom: 10px; color: #e74c3c;">${escapeHtml(docTitle)}</div>` +
                                       `<div style="color: #e74c3c;">预览失败: ${escapeHtml(error.message)}</div>`;
            updateLayout(400, 300);
        });
    } else {
        // 先设置图片源
        previewImage.src = imageData.dataUrl;
        // 等待图片加载完成后，根据图片实际尺寸自适应调整预览窗口
        previewImage.onload = function() {
            const img = this;
            const imgWidth = img.naturalWidth;
            const imgHeight = img.naturalHeight;
            updateLayout(imgWidth, imgHeight);
        };
        
        // 如果图片已经加载完成（缓存情况）
        if (previewImage.complete) {
            previewImage.onload();
        }
    }
    
    // 如果预览窗口未显示，先显示（使用临时尺寸）
    if (!wasVisible) {
        previewWindow.style.left = '20px';
        previewWindow.style.top = '20px';
        previewWindow.style.width = '400px';
        previewWindow.style.height = '400px';
        previewWindow.style.display = 'block';
        previewImage.style.opacity = '0';
    }
    
    // 绑定关闭按钮事件（如果还没有绑定）
    const previewCloseBtn = document.getElementById('chick-preview-close');
    if (previewCloseBtn && !previewCloseBtn._previewCloseBound) {
        previewCloseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            previewWindow.style.display = 'none';
        });
        previewCloseBtn._previewCloseBound = true;
    }
}

// 保存元数据面板状态
function saveMetadataPanelState(isVisible) {
    try {
        localStorage.setItem('chick-metadata-panel-visible', JSON.stringify(isVisible));
    } catch (e) {
        console.error('保存元数据面板状态失败:', e);
    }
}

// 加载元数据面板状态
function loadMetadataPanelState() {
    try {
        const saved = localStorage.getItem('chick-metadata-panel-visible');
        if (saved !== null) {
            return JSON.parse(saved);
        }
    } catch (e) {
        console.error('加载元数据面板状态失败:', e);
    }
    // 默认不显示
    return false;
}

// 页面加载完成后初始化
async function initChick() {
    // 先加载配置
    await loadStorageConfig();
    
    // 根据配置加载图片
    if (storageConfig.use_file_storage) {
        console.log('[Chick] 使用文件系统存储，正在加载图片...');
        const loaded = await loadFromFileStorage();
        // 如果文件系统加载失败，尝试从localStorage加载（作为备份）
        if (!loaded) {
            console.log('[Chick] 文件系统加载失败，尝试从localStorage加载...');
            loadFromLocalStorage();
        }
    } else {
        console.log('[Chick] 使用localStorage存储，正在加载图片...');
        loadFromLocalStorage();
    }
    
    interceptComfyUIErrors();
    // 即刻创建悬浮按钮并注册拖放，无需额外等待
    createButton();
    registerCanvasDrop();
    
    // 添加页面卸载前的保存
    window.addEventListener('beforeunload', () => {
        if (storageConfig.use_file_storage) {
            // 文件系统存储：异步保存（但beforeunload可能无法等待）
            saveImages();
        } else {
            saveToLocalStorage();
        }
    });
    
    // 添加页面隐藏时的保存（移动端和标签页切换）
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            saveImages();
        }
    });
    
    // 定期自动保存（每30秒）
    setInterval(() => {
        if (imageStorage.length > 0) {
            saveImages();
        }
    }, 30000);
    
    console.log('[Chick] 已启用自动保存功能（页面卸载时、每30秒、页面隐藏时）');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChick);
} else {
    initChick();
}

