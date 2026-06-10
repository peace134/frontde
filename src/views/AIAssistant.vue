<template>
  <div class="ai-assistant">
    <div class="chat-header">
      <div>
        <h2>🤖 AI 学习助手</h2>
        <p>我可以帮你拆解任务、总结资料、提供学习建议</p>
      </div>
      <el-button class="clear-btn" text @click="clearChat">清空对话</el-button>
    </div>
    <div class="chat-messages" ref="messagesContainer">
      <div v-for="(msg, index) in messages" :key="index" :class="['message', msg.role]">
        <div class="avatar">
          <el-icon v-if="msg.role === 'user'"><User /></el-icon>
          <el-icon v-else><Cpu /></el-icon>
        </div>
        <div class="content">
          <!-- 文件引用展示 -->
          <div v-if="msg.fileName" class="file-attachment">
            <img v-if="msg.fileType?.startsWith('image/')" :src="msg.previewUrl" class="file-preview-img" alt="图片预览" />
            <div v-else class="file-preview-doc">
              <el-icon><Document /></el-icon>
              <span>{{ msg.fileName }}</span>
            </div>
          </div>
          <div v-html="formatAI(msg.displayText || msg.content)"></div>
        </div>
      </div>
      <div v-if="loading" class="message assistant">
        <div class="avatar"><el-icon><Cpu /></el-icon></div>
        <div class="content typing">正在思考...</div>
      </div>
    </div>
    <!-- 已上传文件预览区 -->
    <div v-if="uploadedFiles.length > 0" class="file-list">
      <div v-for="(file, index) in uploadedFiles" :key="index" class="file-tag">
        <img v-if="file.fileType?.startsWith('image/')" :src="file.previewUrl" class="file-thumb" />
        <el-icon v-else><Document /></el-icon>
        <span class="file-name">{{ file.fileName }}</span>
        <el-icon class="file-remove" @click="removeFile(index)"><Close /></el-icon>
      </div>
    </div>
    <div class="chat-input">
      <div class="input-toolbar">
        <el-button class="tool-btn" @click="triggerUpload('image')" title="上传图片">
          <el-icon><Picture /></el-icon>
        </el-button>
        <el-button class="tool-btn" @click="triggerUpload('document')" title="上传文档">
          <el-icon><Upload /></el-icon>
        </el-button>
        <input
          ref="imageInput"
          type="file"
          accept="image/*"
          style="display:none"
          @change="handleFileSelected($event, 'image')"
        />
        <input
          ref="docInput"
          type="file"
          accept=".pdf,.txt,.doc,.docx"
          style="display:none"
          @change="handleFileSelected($event, 'document')"
        />
        <el-input
          v-model="inputText"
          type="textarea"
          :rows="2"
          placeholder="按 Enter 发送，Shift+Enter 换行"
          @keydown="handleKeydown"
        />
        <el-button type="primary" @click="sendMessage" :loading="loading" class="send-btn">发送</el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { User, Cpu, Document, Close, Picture, Upload } from '@element-plus/icons-vue'
import request from '@/utils/request'
import { formatAI } from '@/utils/format'
import { loadChatHistory, saveChatHistory, clearChatHistory } from '@/utils/chatStorage'

const messages = ref([])
const inputText = ref('')
const loading = ref(false)
const messagesContainer = ref(null)
const imageInput = ref(null)
const docInput = ref(null)
const uploadedFiles = ref([])

// 滚动到底部
const scrollToBottom = async () => {
  await nextTick()
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

// 解析消息中的文件引用
const processMessageRefs = (msg) => {
  const fileRefRegex = /^\[文件：(.+?)（(.+?)）\]\n/
  const match = msg.content.match(fileRefRegex)
  if (match) {
    return {
      ...msg,
      fileName: match[1],
      fileType: match[2],
      displayText: msg.content.slice(match[0].length)
    }
  }
  return msg
}

// 加载历史对话记录
const loadHistory = async () => {
  try {
    const res = await request.get('/ai/history')
    if (res.success && res.data && res.data.length > 0) {
      messages.value = res.data.map(processMessageRefs)
      saveChatHistory(res.data)
    } else {
      await fallbackToLocalOrDefault()
    }
    await scrollToBottom()
  } catch (error) {
    console.error('加载后端历史记录失败，尝试本地缓存', error)
    await fallbackToLocalOrDefault()
  }
}

const fallbackToLocalOrDefault = async () => {
  const local = loadChatHistory()
  if (local && local.length > 0) {
    messages.value = local.map(processMessageRefs)
  } else {
    messages.value = [
      { role: 'assistant', content: '你好！我是你的学习助手，可以帮你拆解学习目标、总结资料、分析学习数据。试试问我："帮我拆解任务"或"给我学习建议"。' }
    ]
  }
  await scrollToBottom()
}

// 触发文件选择
const triggerUpload = (type) => {
  if (type === 'image') {
    imageInput.value?.click()
  } else {
    docInput.value?.click()
  }
}

// 处理文件选择并上传
const handleFileSelected = async (event, type) => {
  const file = event.target.files[0]
  if (!file) return

  // 文件大小限制（10MB）
  if (file.size > 10 * 1024 * 1024) {
    ElMessage.warning('文件大小不能超过 10MB')
    event.target.value = ''
    return
  }

  const formData = new FormData()
  formData.append('file', file)

  try {
    const res = await request.post('/ai/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000
    })
    if (res.success) {
      uploadedFiles.value.push({
        fileId: res.data.fileId,
        fileName: res.data.fileName,
        fileType: res.data.fileType,
        fileSize: res.data.fileSize,
        previewUrl: res.data.previewUrl
      })
      ElMessage.success(`文件「${res.data.fileName}」已上传`)
    } else {
      ElMessage.error(res.message || '文件上传失败')
    }
  } catch (err) {
    ElMessage.error('文件上传失败，请检查后端服务')
    console.error('Upload error:', err)
  }

  // 重置 input，允许再次选择同一文件
  event.target.value = ''
}

// 移除已上传文件
const removeFile = (index) => {
  uploadedFiles.value.splice(index, 1)
}

// 键盘事件处理（Enter 发送，Shift+Enter 换行）
const handleKeydown = (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
}

// 发送消息
const sendMessage = async () => {
  const text = inputText.value.trim()
  if (!text && uploadedFiles.value.length === 0) return

  const fileIds = uploadedFiles.value.map(f => f.fileId)
  const displayContent = text || '请分析已上传的文件'

  // 构建用户消息内容（含文件引用）
  let userContent = displayContent
  let userFileName = null
  let userFileType = null
  let userPreviewUrl = null

  if (uploadedFiles.value.length > 0) {
    const file = uploadedFiles.value[0]
    userContent = `[文件：${file.fileName}（${file.fileType}）]\n${displayContent}`
    userFileName = file.fileName
    userFileType = file.fileType
    userPreviewUrl = file.previewUrl
  }

  // 添加用户消息
  messages.value.push({
    role: 'user',
    content: userContent,
    fileName: userFileName,
    fileType: userFileType,
    previewUrl: userPreviewUrl,
    displayText: displayContent
  })

  // 清空输入和已上传文件
  inputText.value = ''
  uploadedFiles.value = []
  await scrollToBottom()
  loading.value = true

  try {
    const res = await request.post('/ai/chat', {
      question: text,
      fileIds: fileIds,
      userId: localStorage.getItem('userId')
    }, { timeout: 60000 })
    if (res.success) {
      messages.value.push({ role: 'assistant', content: res.data.answer })
    } else {
      messages.value.push({ role: 'assistant', content: '抱歉，服务出错了，请稍后再试。' })
    }
    saveChatHistory(messages.value)
  } catch (error) {
    console.error('AI 请求失败', error)
    messages.value.push({ role: 'assistant', content: '网络错误，请检查后端服务是否运行。' })
  } finally {
    loading.value = false
    await scrollToBottom()
  }
}

// 清空对话
const clearChat = async () => {
  try {
    await ElMessageBox.confirm('确定要清空所有对话记录吗？此操作不可恢复。', '确认清空', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
  } catch {
    return
  }
  clearChatHistory()
  messages.value = [
    { role: 'assistant', content: '对话已清空，有什么可以帮助你的吗？' }
  ]
  try {
    await request.delete('/ai/history')
  } catch (e) {
    // 后端清除失败不影响前端
  }
  ElMessage.success('对话记录已清空')
}

onMounted(() => {
  loadHistory()
})
</script>

<style scoped>
.ai-assistant {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 120px);
  background: #f8f9fc;
  border-radius: 12px;
  overflow: hidden;
}
.chat-header {
  background: white;
  padding: 16px 20px;
  border-bottom: 1px solid #e6e6e6;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.chat-header h2 {
  margin: 0 0 4px 0;
  font-size: 20px;
}
.chat-header p {
  margin: 0;
  color: #666;
  font-size: 13px;
}
.chat-header .clear-btn {
  flex-shrink: 0;
}
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.message {
  display: flex;
  gap: 12px;
  max-width: 80%;
}
.message.user {
  align-self: flex-end;
  flex-direction: row-reverse;
}
.message.user .content {
  background-color: #409eff;
  color: white;
  border-radius: 16px 16px 4px 16px;
}
.message.assistant .content {
  background-color: white;
  color: #333;
  border-radius: 16px 16px 16px 4px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}
.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background-color: #e6e6e6;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.content {
  padding: 10px 14px;
  line-height: 1.5;
  word-break: break-word;
}
.typing {
  color: #999;
}

/* 文件引用展示（在消息气泡内） */
.file-attachment {
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255,255,255,0.2);
}
.message.user .file-attachment {
  border-bottom-color: rgba(255,255,255,0.3);
}
.message.assistant .file-attachment {
  border-bottom-color: #eee;
}
.file-preview-img {
  max-width: 180px;
  max-height: 180px;
  border-radius: 8px;
  display: block;
}
.file-preview-doc {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #666;
}
.message.user .file-preview-doc {
  color: rgba(255,255,255,0.9);
}

/* 已上传文件预览区 */
.file-list {
  background: white;
  border-top: 1px solid #e6e6e6;
  padding: 8px 20px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.file-tag {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #f0f2f5;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 13px;
}
.file-thumb {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  object-fit: cover;
}
.file-name {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.file-remove {
  cursor: pointer;
  font-size: 14px;
  color: #999;
  margin-left: 4px;
}
.file-remove:hover {
  color: #f56c6c;
}

/* 输入区域 */
.chat-input {
  background: white;
  border-top: 1px solid #e6e6e6;
  padding: 12px 20px;
}
.input-toolbar {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}
.tool-btn {
  padding: 8px;
  font-size: 18px;
  border: none;
  background: transparent;
  color: #666;
  cursor: pointer;
  flex-shrink: 0;
}
.tool-btn:hover {
  color: #409eff;
  background: #f0f2f5;
}
.input-toolbar .el-textarea {
  flex: 1;
}
.send-btn {
  flex-shrink: 0;
  height: 36px;
  margin-left: 4px;
}
</style>