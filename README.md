# 🐣 Chick Temporary Save - ComfyUI 图片临时存储插件

一个功能强大的 ComfyUI 插件，提供图片临时存储、管理和导出功能。

<img width="853" height="587" alt="ScreenShot_2025-12-06_150521_253" src="https://github.com/user-attachments/assets/dbd4e24f-6901-45c5-ae97-b56775179a30" />

---

## ✨ 主要功能

### 📷 图片管理
- **多种导入方式**：拖放、粘贴按钮、上传
- **图片选择**：单选、多选（Shift+点击）、全选（Ctrl+A）
- **持久化存储**：图片自动保存到 `cache` 文件夹，重启不丢失
- **自动保存**：防抖机制，上传后自动保存，不影响使用体验

### 🎯 图片操作
- **导出到画布**：选中图片导出为 LoadImage 节点
- **保存到本地**：支持多选保存（File System Access API）
- **复制到剪贴板**：双击图片复制
- **批量删除**：支持批量删除，自动清理文件

### 📋 元数据查看
- **完整元数据**：查看图片的所有元数据信息
- **文本节点提取**：自动提取 ComfyUI 工作流中所有文本节点的文本内容
- **一键复制**：支持复制提示词和文本内容

### 🖱️ 拖拽功能
- **拖拽到画布**：直接拖拽图片到画布创建节点
- **窗口操作**：可拖拽移动、可调整大小

---

## 📦 安装

1. 将插件文件夹放到 `ComfyUI/custom_nodes` 目录
2. 重启 ComfyUI
3. 在浏览器中会看到屏幕中央的 🐣 按钮

---

## 🚀 使用指南

### 基本操作

**打开窗口**：点击 🐣 按钮

**添加图片**：
- 拖放图片到窗口
- 点击 📋 粘贴按钮粘贴图片
- 点击 📤 上传按钮

**选择图片**：
- 点击：单选
- `Shift+点击`：多选
- `Ctrl+A`：全选
- 点击空白处：取消选择

**导出到画布**：
1. 选择图片
2. 点击 📤 导出按钮
3. 图片自动创建为 LoadImage 节点

**保存到本地**：
1. 选择图片
2. 点击 💾 保存按钮
3. 选择保存位置（现代浏览器）

**查看元数据**：
- 点击图片查看完整元数据
- 包括所有文本节点的文本内容
- 支持一键复制

**删除图片**：
- 选择图片后点击 🗑️ 删除按钮
- 或按 `Delete` 键
- 自动清理 cache 文件夹中的文件

---

## ⌨️ 快捷键

| 快捷键 | 功能 |
|--------|------|
| `ESC` | 关闭窗口 |
| `Delete` | 删除选中图片 |
| `Ctrl+A` | 全选 |

---

## 📄 许可证

MIT License

### 使用许可

**个人使用**：免费

**商业平台使用**：需通知作者授权

---

---

# 🐣 Chick Temporary Save - ComfyUI Image Temporary Storage Plugin

A powerful ComfyUI plugin that provides image temporary storage, management, and export functionality.

---

## ✨ Main Features

### 📷 Image Management
- **Multiple Import Methods**: Drag & drop, paste button, upload
- **Image Selection**: Single select, multi-select (Shift+click), select all (Ctrl+A)
- **Persistent Storage**: Images are automatically saved to the `cache` folder and won't be lost after restart
- **Auto Save**: Debounce mechanism, automatically saves after upload without affecting user experience

### 🎯 Image Operations
- **Export to Canvas**: Export selected images as LoadImage nodes
- **Save to Local**: Supports multi-select save (File System Access API)
- **Copy to Clipboard**: Double-click image to copy
- **Batch Delete**: Supports batch deletion with automatic file cleanup

### 📋 Metadata Viewing
- **Complete Metadata**: View all metadata information of images
- **Text Node Extraction**: Automatically extracts text content from all text nodes in ComfyUI workflow
- **One-Click Copy**: Supports copying prompts and text content

### 🖱️ Drag & Drop Features
- **Drag to Canvas**: Directly drag images to canvas to create nodes
- **Window Operations**: Draggable and resizable

---

## 📦 Installation

1. Place the plugin folder in the `ComfyUI/custom_nodes` directory
2. Restart ComfyUI
3. You will see the 🐣 button in the center of the screen in your browser

---

## 🚀 Usage Guide

### Basic Operations

**Open Window**: Click the 🐣 button

**Add Images**:
- Drag and drop images to the window
- Click the 📋 paste button to paste images
- Click the 📤 upload button

**Select Images**:
- Click: Single select
- `Shift+Click`: Multi-select
- `Ctrl+A`: Select all
- Click blank area: Deselect

**Export to Canvas**:
1. Select images
2. Click the 📤 export button
3. Images are automatically created as LoadImage nodes

**Save to Local**:
1. Select images
2. Click the 💾 save button
3. Choose save location (modern browsers)

**View Metadata**:
- Click image to view complete metadata
- Includes text content from all text nodes
- Supports one-click copy

**Delete Images**:
- Select images and click the 🗑️ delete button
- Or press the `Delete` key
- Automatically cleans up files in the cache folder

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Function |
|--------|------|
| `ESC` | Close window |
| `Delete` | Delete selected images |
| `Ctrl+A` | Select all |

---

## 📄 License

MIT License

### Usage License

**Personal Use**: Free

**Commercial Platform Use**: Please notify the author for authorization

---

**Made with 🐣 by Chick Team**
