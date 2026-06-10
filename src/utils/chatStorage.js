// E:\javadaima\frontend\src\utils\chatStorage.js

const STORAGE_KEY = 'ai_chat_history'

// 从 localStorage 加载对话历史
export function loadChatHistory() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) {
            const data = JSON.parse(raw)
            if (Array.isArray(data) && data.length > 0) {
                return data
            }
        }
    } catch (e) {
        console.error('读取对话历史失败', e)
    }
    return null
}

// 保存对话历史到 localStorage
export function saveChatHistory(messages) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
    } catch (e) {
        console.error('保存对话历史失败', e)
    }
}

// 清除对话历史
export function clearChatHistory() {
    try {
        localStorage.removeItem(STORAGE_KEY)
    } catch (e) {
        console.error('清除对话历史失败', e)
    }
}