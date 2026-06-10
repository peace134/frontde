// E:\javadaima\frontend\src\utils\analysisStorage.js

const STORAGE_KEY_PREFIX = 'ai_analysis_'

/**
 * 加载指定文档的 AI 分析结果
 * @param {number|string} documentId
 * @returns {object|null}
 */
export function loadAnalysis(documentId) {
    try {
        const raw = localStorage.getItem(STORAGE_KEY_PREFIX + documentId)
        if (raw) {
            return JSON.parse(raw)
        }
    } catch (e) {
        console.error('读取分析结果失败', e)
    }
    return null
}

/**
 * 保存 AI 分析结果到 localStorage
 * @param {number|string} documentId
 * @param {object} data - 包含 summary, keyPoints, tags, questions, documentType, lastAnalyzed
 */
export function saveAnalysis(documentId, data) {
    try {
        localStorage.setItem(STORAGE_KEY_PREFIX + documentId, JSON.stringify(data))
    } catch (e) {
        console.error('保存分析结果失败', e)
    }
}

/**
 * 清除指定文档的 AI 分析结果
 * @param {number|string} documentId
 */
export function clearAnalysis(documentId) {
    try {
        localStorage.removeItem(STORAGE_KEY_PREFIX + documentId)
    } catch (e) {
        console.error('清除分析结果失败', e)
    }
}