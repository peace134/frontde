<template>
  <div class="analysis-panel">
    <!-- AI 分析按钮 -->
    <div class="analysis-header">
      <el-button
          type="primary"
          :loading="loading"
          @click="triggerAnalysis"
          size="large"
      >
        🤖  AI 分析资料
      </el-button>
      <span v-if="lastAnalyzed" class="last-time">
        上次分析：{{ lastAnalyzed }}
      </span>
    </div>

    <!-- 分析结果 -->
    <div v-if="analysis" class="analysis-result">
      <!-- 摘要 -->
      <el-card class="section" shadow="hover">
        <template #header>
          <div class="section-title">
            <span>📝 AI 摘要</span>
            <el-tag v-if="analysis.documentType" size="small" type="info">
              {{ analysis.documentType }}
            </el-tag>
          </div>
        </template>
        <div class="summary-text" v-html="formatAI(analysis.summary)"></div>
      </el-card>

      <!-- 核心要点 -->
      <el-card v-if="analysis.keyPoints && analysis.keyPoints.length" class="section" shadow="hover">
        <template #header>🎯 核心要点</template>
        <el-timeline>
          <el-timeline-item
              v-for="(point, i) in analysis.keyPoints"
              :key="i"
              :timestamp="'要点 ' + (i + 1)"
              placement="top"
          >
            <span v-html="formatAI(point)"></span>
          </el-timeline-item>
        </el-timeline>
      </el-card>

      <!-- 标签 -->
      <el-card v-if="analysis.tags && analysis.tags.length" class="section" shadow="hover">
        <template #header>🏷️ 标签</template>
        <div class="tags-wrapper">
          <el-tag
              v-for="tag in analysis.tags"
              :key="tag"
              class="tag-item"
              type="warning"
              effect="plain"
              closable
              @close="removeTag(tag)"
          >
            {{ tag }}
          </el-tag>
        </div>
      </el-card>

      <!-- 思考题 -->
      <el-card v-if="analysis.questions && analysis.questions.length" class="section" shadow="hover">
        <template #header>💡 思考题</template>
        <el-collapse v-model="activeQuestionIndex" accordion>
          <el-collapse-item
              v-for="(q, i) in analysis.questions"
              :key="i"
              :title="'问题 ' + (i + 1)"
              :name="i"
          >
            <span v-html="formatAI(q)"></span>
          </el-collapse-item>
        </el-collapse>
      </el-card>
    </div>

    <!-- 未分析过 -->
    <div v-else class="analysis-empty">
      <el-empty description="尚未进行 AI 分析，点击上方按钮开始" />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import request from '@/utils/request'
import { formatAI } from '@/utils/format'

const props = defineProps({
  document: { type: Object, required: true }
})

const emit = defineEmits(['analysis-complete'])

const loading = ref(false)
const analysis = ref(null)
const lastAnalyzed = ref('')
const activeQuestionIndex = ref(0)
const fetchingAnalysis = ref(false)
// POST 触发后台分析，立即返回
await request.post(`/documents/${props.document.id}/analyze`)
ElMessage.info('AI 分析已启动，正在生成结果...')

// 每 2 秒轮询，直到 lastAnalyzed 有值
const hasResult = await pollAnalysisResult()
if (hasResult) {
  ElMessage.success('AI 分析完成！')
  emit('analysis-complete', analysis.value)
}
// 从后端 GET /documents/{id}/analysis 读取已持久化的分析结果
const fetchAnalysis = async () => {
  if (!props.document?.id) return
  fetchingAnalysis.value = true
  try {
    const res = await request.get(`/documents/${props.document.id}/analysis`)
    if (res.success && res.data) {
      analysis.value = res.data.data || null
      lastAnalyzed.value = res.data.lastAnalyzed || ''
    }
  } catch {
    // 接口不可用或未分析过，静默处理
  } finally {
    fetchingAnalysis.value = false
  }
}

// 组件挂载或 document 变化时从后端加载
onMounted(() => {
  fetchAnalysis()
})

watch(() => props.document?.id, () => {
  fetchAnalysis()
})

const triggerAnalysis = async () => {
  loading.value = true
  try {
    const res = await request.post(`/documents/${props.document.id}/analyze`)
    if (res.success) {
      ElMessage.success('AI 分析完成！')
      // 分析结果已由后端持久化，重新从后端读取完整数据
      await fetchAnalysis()
      // 通知父组件更新卡片摘要等展示
      emit('analysis-complete', res.data)
    } else {
      ElMessage.error(res.message || 'AI 分析失败')
    }
  } catch (e) {
    ElMessage.error('AI 分析失败，请稍后重试')
  } finally {
    loading.value = false
  }
}

const removeTag = (tag) => {
  if (!analysis.value) return
  analysis.value.tags = analysis.value.tags.filter(t => t !== tag)
}
</script>

<style scoped>
.analysis-panel {
  margin-top: 8px;
}
.analysis-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
}
.last-time {
  font-size: 12px;
  color: #999;
}
.section {
  margin-bottom: 16px;
}
.section-title {
  display: flex;
  align-items: center;
  gap: 12px;
}
.summary-text {
  font-size: 15px;
  line-height: 1.8;
  color: #303133;
  margin: 0;
}
.tags-wrapper {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.tag-item {
  margin: 2px;
}
.analysis-empty {
  margin-top: 40px;
}
</style>