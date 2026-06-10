<template>
  <div class="ai-embed">
    <div class="chat-messages" ref="messagesRef">
      <div v-for="(msg, idx) in messages" :key="idx" :class="['message', msg.role]">
        <div class="content" v-html="formatAI(msg.content)"></div>
      </div>
    </div>
    <div class="input-area">
      <el-input
          v-model="input"
          type="textarea"
          :rows="3"
          placeholder="问AI：帮我拆解任务/总结资料/解读数据..."
          @keyup.ctrl.enter="sendMessage"
      />
      <el-button type="primary" @click="sendMessage" style="margin-top: 8px">发送</el-button>
      <el-button @click="clearChat" style="margin-top: 8px">清空</el-button>
      <el-button @click="clearChat" style="margin-top: 8px">清空</el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '@/utils/request'
import { formatAI } from '@/utils/format'
import { loadChatHistory, saveChatHistory, clearChatHistory } from '@/utils/chatStorage'

const messages = ref([
  { role: 'assistant', content: '你好！我是你的学习助手，可以帮你拆解学习目标、总结资料、分析学习数据。' }
])
const input = ref('')
const messagesRef = ref(null)

await request.post(`/documents/${docId}/analyze`)

const pollTimer = setInterval(async () => {
  const res = await request.get(`/documents/${docId}/analysis`)
  if (res.success && res.data && res.data.lastAnalyzed) {
    clearInterval(pollTimer)
    // 更新卡片摘要和标签
  }
}, 2000)
const sendMessage = async () => {
  if (!input.value.trim()) return
  const userMsg = { role: 'user', content: input.value }
  messages.value.push(userMsg)
  input.value = ''
  await nextTick()
  scrollToBottom()

  try {
    const res = await request.post('/ai/chat', {
      question: userMsg.content,
      userId: localStorage.getItem('userId')
    })
    const assistantMsg = { role: 'assistant', content: res.answer || '抱歉，我暂时无法回答这个问题。' }
    messages.value.push(assistantMsg)
    saveChatHistory(messages.value)
    await nextTick()
    scrollToBottom()
  } catch (error) {
    ElMessage.error('AI 服务请求失败')
    messages.value.push({ role: 'assistant', content: '网络错误，请稍后再试。' })
  }
}

const clearChat = async () => {
  try {
    await ElMessageBox.confirm('确定要清空所有对话记录吗？', '确认清空', {
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
  } catch (e) {}
  ElMessage.success('对话已清空')
}

const scrollToBottom = () => {
  if (messagesRef.value) {
    messagesRef.value.scrollTop = messagesRef.value.scrollHeight
  }
}

onMounted(() => {
  const local = loadChatHistory()
  if (local) {
    messages.value = local
    nextTick(() => scrollToBottom())
  }
})
</script>

<style scoped>
.ai-embed {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}
.message {
  margin-bottom: 12px;
  display: flex;
}
.message.user {
  justify-content: flex-end;
}
.message.user .content {
  background-color: #409eff;
  color: white;
  border-radius: 12px 12px 4px 12px;
}
.message.assistant .content {
  background-color: #f4f4f5;
  color: #333;
  border-radius: 12px 12px 12px 4px;
}
.content {
  max-width: 80%;
  padding: 8px 12px;
  word-wrap: break-word;
}
.input-area {
  padding: 12px;
  border-top: 1px solid #e6e6e6;
}
</style>