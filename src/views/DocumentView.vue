<template>
  <div class="document-container">
    <!-- 顶部工具栏 -->
    <el-row :gutter="20" class="toolbar">
      <el-col :span="8">
        <el-input v-model="searchKeyword" placeholder="全文检索 / 备注关键词" clearable @keyup.enter="handleSearch" @clear="handleClearSearch">
          <template #append>
            <el-button @click="handleSearch">搜索</el-button>
          </template>
        </el-input>
      </el-col>
      <el-col :span="4">
        <el-button type="primary" @click="uploadDialogVisible = true">上传资料</el-button>
      </el-col>
      <el-col :span="4">
        <el-button @click="addNoteDialogVisible = true">添加笔记</el-button>
      </el-col>
    </el-row>

    <!-- 文档卡片列表 -->
    <div class="card-list" v-loading="loading">
      <el-card v-for="doc in documents" :key="doc.id" class="doc-card" shadow="hover">
        <div class="card-header">
          <el-link :underline="false" @click="openDocument(doc)" class="doc-name">{{ doc.name }}</el-link>
          <div class="card-actions">
            <el-button type="text" @click="toggleStar(doc)" :title="doc.isStarred ? '取消收藏' : '收藏'">
              <el-icon><Star :color="doc.isStarred ? '#ffc107' : ''" /></el-icon>
            </el-button>
            <el-button type="text" @click="toggleTop(doc)" :title="doc.isTop ? '取消置顶' : '置顶'">
              <el-icon><Top :color="doc.isTop ? '#409eff' : ''" /></el-icon>
            </el-button>
            <el-button type="text" @click="deleteDocument(doc)" title="删除">
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
        </div>
        <div class="card-content">
          <p><strong>标签：</strong>{{ doc.tags }}</p>
          <p class="summary"><strong>AI摘要：</strong>{{ doc.summary || '无' }}</p>
          <p class="remark"><strong>备注：</strong><el-input v-model="doc.remark" size="small" placeholder="添加备注" @change="updateRemark(doc)" /></p>
        </div>
        <div class="card-footer">
          <el-button type="text" @click="showDetail(doc)">查看详情</el-button>
          <el-button type="text" @click="downloadDocument(doc)">下载</el-button>
        </div>
      </el-card>
    </div>

    <el-card class="recent-access" style="margin-top: 20px" v-if="recentDocs.length">
      <template #header>最近访问</template>
      <el-tag v-for="doc in recentDocs" :key="doc.id" style="margin-right: 10px; cursor: pointer" @click="openDocument(doc)">
        {{ doc.name }}
      </el-tag>
    </el-card>

    <!-- 上传对话框 -->
    <el-dialog v-model="uploadDialogVisible" title="上传资料" width="500px">
      <el-upload drag action="/api/documents/upload" :headers="{ Authorization: `Bearer ${token}` }" :data="{ userId, subject: currentSubject, chapter: currentChapter }" :on-success="handleUploadSuccess" :before-upload="beforeUpload" multiple>
        <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
        <div class="el-upload__text">将文件拖到此处，或<em>点击上传</em></div>
        <template #tip><div class="el-upload__tip">支持 PDF/Word/Excel/JPG/PNG，单个文件≤100MB，每日≤50个</div></template>
      </el-upload>
    </el-dialog>

    <!-- 添加笔记对话框 -->
    <el-dialog v-model="addNoteDialogVisible" title="添加文本笔记" width="500px">
      <el-form :model="newNote" label-width="80px">
        <el-form-item label="标题"><el-input v-model="newNote.title" /></el-form-item>
        <el-form-item label="学科"><el-input v-model="newNote.subject" /></el-form-item>
        <el-form-item label="章节"><el-input v-model="newNote.chapter" /></el-form-item>
        <el-form-item label="内容"><el-input type="textarea" v-model="newNote.content" rows="5" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addNoteDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitNote">确定</el-button>
      </template>
    </el-dialog>

    <!-- 资料详情弹窗 -->
    <el-dialog v-model="detailVisible" :title="currentDoc?.name || '资料详情'" width="600px" top="5vh">
      <template v-if="currentDoc">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="文件名">{{ currentDoc.name }}</el-descriptions-item>
          <el-descriptions-item label="类型">{{ currentDoc.type }}</el-descriptions-item>
          <el-descriptions-item label="章节">{{ currentDoc.chapter || '-' }}</el-descriptions-item>
          <el-descriptions-item label="上传时间">{{ formatDate(currentDoc.createdAt) }}</el-descriptions-item>
          <el-descriptions-item label="标签">{{ currentDoc.tags || '-' }}</el-descriptions-item>
          <el-descriptions-item label="AI 摘要" :span="2">{{ currentDoc.summary || '暂无摘要' }}</el-descriptions-item>
        </el-descriptions>
        <el-divider />
        <DocumentAnalysis
          :document="currentDoc"
          @analysis-complete="onAnalysisComplete"
        />
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Star, Top, UploadFilled, Delete } from '@element-plus/icons-vue'
import request from '@/utils/request'
import DocumentAnalysis from '@/components/DocumentAnalysis.vue'

const route = useRoute()
const userId = localStorage.getItem('userId')
const token = localStorage.getItem('token')
const documents = ref([])

// 排序：置顶的永远在最前面，其余按创建时间倒序
const sortDocuments = (list) => {
  return list.sort((a, b) => {
    if (a.isTop && !b.isTop) return -1
    if (!a.isTop && b.isTop) return 1
    return new Date(b.createdAt) - new Date(a.createdAt)
  })
}
const recentDocs = ref([])
const searchKeyword = ref('')
const loading = ref(false)
const currentSubject = ref('')
const currentChapter = ref('')
const uploadDialogVisible = ref(false)
const addNoteDialogVisible = ref(false)
const newNote = reactive({ title: '', subject: '', chapter: '', content: '' })

// 详情弹窗
const detailVisible = ref(false)
const currentDoc = ref(null)

const loadDocuments = async () => {
  loading.value = true
  try {
    const res = await request.get('/documents', { params: { userId } })
    if (res.success) documents.value = sortDocuments(res.data)
    else ElMessage.error('加载资料失败')
  } catch { ElMessage.error('请求失败') }
  finally { loading.value = false }
}

const loadRecent = async () => {
  try {
    const res = await request.get('/documents/recent', { params: { userId } })
    if (res.success) recentDocs.value = res.data
  } catch {}
}

const handleSearch = async () => {
  if (!searchKeyword.value.trim()) return loadDocuments()
  loading.value = true
  try {
    const res = await request.get('/documents/search', { params: { userId, keyword: searchKeyword.value } })
    if (res.success) documents.value = sortDocuments(res.data)
    else ElMessage.error('搜索失败')
  } catch { ElMessage.error('请求失败') }
  finally { loading.value = false }
}

const handleClearSearch = () => {
  searchKeyword.value = ''
  loadDocuments()
}

const openDocument = (doc) => {
  if (doc.type === 'note') {
    ElMessage.info(`笔记内容：${doc.content || '无内容'}`)
    return
  }
  fetch(`/api/documents/file/${doc.id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        if (!res.ok) throw new Error('加载失败')
        return res.blob()
      })
      .then(blob => {
        const url = URL.createObjectURL(blob)
        window.open(url, '_blank')
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      })
      .catch(() => ElMessage.error('打开文件失败'))
}

const downloadDocument = (doc) => {
  if (doc.type === 'note') {
    ElMessage.warning('笔记不支持下载')
    return
  }
  fetch(`/api/documents/file/${doc.id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        if (!res.ok) throw new Error('下载失败')
        return res.blob()
      })
      .then(blob => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = doc.name
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      })
      .catch(() => ElMessage.error('下载失败'))
}

const beforeUpload = (file) => {
  const isLt100M = file.size / 1024 / 1024 < 100
  if (!isLt100M) { ElMessage.error('文件大小不能超过100MB'); return false }
  const ext = file.name.split('.').pop().toLowerCase()
  const allowed = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'png']
  if (!allowed.includes(ext)) { ElMessage.error('不支持的文件格式'); return false }
  return true
}

const handleUploadSuccess = (response) => {
  ElMessage.success('上传成功')
  uploadDialogVisible.value = false
  loadDocuments()
  loadRecent()

  // 获取新上传文档的 ID，自动进行 AI 分析
  const docId = response?.data?.id
  if (docId) {
    autoAnalyzeDocument(docId)
  }
}

// 自动对刚上传的资料执行 AI 分析（后端自动持久化结果）
const autoAnalyzeDocument = async (docId) => {
  const loadingMsg = ElMessage.info('AI 分析进行中，请稍候...')
  try {
    const res = await request.post(`/documents/${docId}/analyze`)
    if (res.success) {
      ElMessage.success('AI 分析完成！')
      // 更新本地文档列表的摘要和标签（卡片展示用）
      await loadDocuments()
      const found = documents.value.find(d => d.id === docId)
      if (found) {
        found.summary = res.data.summary
        if (res.data.tags) {
          found.tags = res.data.tags.join(', ')
        }
      }
    }
  } catch {
    // 分析失败不影响资料上传本身
  } finally {
    loadingMsg.close()
  }
}

const submitNote = async () => {
  try {
    await request.post('/documents/note', { ...newNote, userId })
    ElMessage.success('笔记添加成功')
    addNoteDialogVisible.value = false
    Object.assign(newNote, { title: '', subject: '', chapter: '', content: '' })
    loadDocuments()
  } catch { ElMessage.error('添加失败') }
}

const updateRemark = async (doc) => {
  try {
    await request.put(`/documents/${doc.id}/remark`, { remark: doc.remark })
    ElMessage.success('备注已更新')
  } catch { ElMessage.error('更新失败') }
}

const toggleStar = async (doc) => {
  try {
    await request.put(`/documents/${doc.id}/star`, null, { params: { starred: !doc.isStarred } })
    doc.isStarred = !doc.isStarred
    ElMessage.success(doc.isStarred ? '已收藏' : '已取消收藏')
  } catch { ElMessage.error('操作失败') }
}

const toggleTop = async (doc) => {
  try {
    await request.put(`/documents/${doc.id}/top`, null, { params: { top: !doc.isTop } })
    doc.isTop = !doc.isTop
    ElMessage.success(doc.isTop ? '已置顶' : '已取消置顶')
  } catch { ElMessage.error('操作失败') }
}

const deleteDocument = async (doc) => {
  try {
    await ElMessageBox.confirm(`确定删除资料“${doc.name}”吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await request.delete(`/documents/${doc.id}`)
    ElMessage.success('删除成功')
    loadDocuments()
    loadRecent()
  } catch (err) {
    if (err !== 'cancel') ElMessage.error('删除失败')
  }
}

const showDetail = (doc) => {
  currentDoc.value = doc
  detailVisible.value = true
}

// 分析完成回调——数据已由后端持久化，仅更新前端展示
const onAnalysisComplete = (data) => {
  if (!currentDoc.value) return

  // 更新当前文档对象（前端即时反馈到详情窗描述区）
  currentDoc.value.summary = data.summary
  if (data.tags) {
    currentDoc.value.tags = data.tags.join(', ')
  }

  // 刷新文档列表，应用到对应的文档卡片
  loadDocuments().then(() => {
    const found = documents.value.find(d => d.id === currentDoc.value.id)
    if (found) {
      found.summary = data.summary
      if (data.tags) {
        found.tags = data.tags.join(', ')
      }
    }
  })
}

// 从路由参数自动打开资料详情（今日看板"查看"跳转过来）
const openDocFromRoute = () => {
  const docId = route.query.openDocId
  if (!docId) return
  const found = documents.value.find(d => String(d.id) === String(docId))
  if (found) {
    showDetail(found)
  }
}

const formatDate = (isoStr) => {
  if (!isoStr) return '-'
  return new Date(isoStr).toLocaleString('zh-CN', { hour12: false })
}

onMounted(() => {
  loadDocuments()
  loadRecent()
})

// 监听路由参数变化（从看板点击"查看"或手动输入）
watch(() => route.query.openDocId, () => {
  openDocFromRoute()
})
</script>

<style scoped>
.document-container { padding: 10px; }
.toolbar { margin-bottom: 20px; }
.card-list { display: flex; flex-wrap: wrap; gap: 20px; }
.doc-card { width: 320px; }
.card-header { display: flex; justify-content: space-between; align-items: center; }
.doc-name { font-weight: bold; font-size: 16px; }
.card-actions { display: flex; gap: 4px; }
.card-content p { margin: 8px 0; font-size: 13px; color: #666; }
.summary, .remark { word-break: break-word; }
.card-footer { margin-top: 12px; text-align: right; }
.recent-access { margin-top: 20px; }
</style>