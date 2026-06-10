<template>
  <div class="dashboard-container">
    <!-- 欢迎区和AI建议 -->
    <el-row :gutter="20">
      <el-col :span="16">
        <div class="welcome-card">
          <h2>{{ welcomeMessage }}</h2>
          <el-tag type="info" size="large">AI今日建议：{{ aiSuggestion }}</el-tag>
        </div>
      </el-col>
      <el-col :span="8" class="quick-actions">
        <el-button type="primary" @click="showAddTaskDialog">+ 一键添加任务</el-button>
        <el-button type="success" @click="openFocusTimer">🍅 专注计时</el-button>
      </el-col>
    </el-row>


    <!-- 指标卡片 -->
    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="6">
        <el-card shadow="hover">
          <template #header>📋 今日任务进度</template>
          <div class="card-value">{{ completedTasks }}/{{ totalTasks }}</div>
          <el-progress :percentage="completionRate" />
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <template #header>⚠️ 逾期任务</template>
          <div class="card-value" :class="{ overdue: overdueTasks > 0 }">{{ overdueTasks }}</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <template #header>⏱️ 今日专注时长</template>
          <div class="card-value">{{ todayFocusMinutes }} 分钟</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <template #header>💡 推荐资料</template>
          <div class="card-value">{{ recommendDocs.length }} 篇</div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 燃尽图和饼图 -->
    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="14">
        <el-card shadow="hover">
          <template #header>📈 任务燃尽图（近7天）</template>
          <div ref="burnDownChart" style="height: 300px" v-if="burnDownData.length"></div>
          <div v-else>暂无数据</div>
          <div style="text-align: center">
            <el-link type="primary" @click="$router.push('/tasks')">查看完整图表 →</el-link>
          </div>
        </el-card>
      </el-col>
      <el-col :span="10">
        <el-card shadow="hover">
          <template #header>🥧 任务完成率</template>
          <div ref="pieChart" style="height: 250px"></div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 最近访问资料 -->
    <el-card style="margin-top: 20px">
      <template #header>📁 最近访问资料</template>
      <el-table :data="recentDocs" stripe>
        <el-table-column prop="name" label="名称" />
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button type="text" @click="viewDocument(row.id)">查看</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 快速添加任务弹窗 -->
    <el-dialog v-model="addTaskDialog" title="快速添加任务" width="500px">
      <el-form :model="quickTask" label-width="80px">
        <el-form-item label="标题">
          <el-input v-model="quickTask.title" />
        </el-form-item>
        <el-form-item label="优先级">
          <el-select v-model="quickTask.priority">
            <el-option label="高" value="high" />
            <el-option label="中" value="medium" />
            <el-option label="低" value="low" />
          </el-select>
        </el-form-item>
        <el-form-item label="截止时间">
          <el-date-picker v-model="quickTask.deadline" type="datetime" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addTaskDialog = false">取消</el-button>
        <el-button type="primary" @click="submitQuickTask">确定</el-button>
      </template>
    </el-dialog>
    <!-- 专注计时器组件 -->
    <FocusTimer ref="focusTimerRef" />
  </div>

</template>


<script setup>
import { ref, onMounted, reactive, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import * as echarts from 'echarts'
import request from '@/utils/request'


import FocusTimer from '@/components/FocusTimer.vue'

const router = useRouter()
const focusTimerRef = ref(null)   // 注意 null 不需要 value: null

const openFocusTimer = () => {
  focusTimerRef.value?.openDialog()
}
const welcomeMessage = ref('')
const aiSuggestion = ref('')
const totalTasks = ref(0)
const completedTasks = ref(0)
const completionRate = ref(0)
const overdueTasks = ref(0)
const todayFocusMinutes = ref(0)
const recentDocs = ref([])
const recommendDocs = ref([])
const burnDownData = ref([])

const addTaskDialog = ref(false)
const quickTask = reactive({ title: '', priority: 'medium', deadline: null })
const burnDownChart = ref(null)
const pieChart = ref(null)


const fetchDashboard = async () => {
  try {
    const res = await request.get('/dashboard/data')
    if (res.success) {
      const data = res.data
      welcomeMessage.value = data.welcomeMessage || ''
      aiSuggestion.value = data.aiSuggestion || ''
      totalTasks.value = data.totalTasks || 0
      completedTasks.value = data.completedTasks || 0
      completionRate.value = data.completionRate || 0
      overdueTasks.value = data.overdueTasks || 0
      todayFocusMinutes.value = data.todayFocusMinutes || 0
      recentDocs.value = data.recentDocuments || []
      recommendDocs.value = data.recommendDocuments || []
      burnDownData.value = data.burnDownData || []

      // 等待 DOM 更新（v-if 创建的图表容器渲染完成）再初始化 ECharts
      await nextTick()
      renderBurnDownChart()
      renderPieChart()

      // 额外获取所有任务（长期+短期）合并统计到饼图中
      try {
        const userId = localStorage.getItem('userId')
        const taskRes = await request.get('/tasks', { params: { userId } })
        const allTasks = Array.isArray(taskRes) ? taskRes : (taskRes.data || [])
        const total = allTasks.length
        const completed = allTasks.filter(t => t.status === 1 || t.timerStatus === 'completed').length
        totalTasks.value = total
        completedTasks.value = completed
        completionRate.value = total > 0 ? Math.round((completed / total) * 100) : 0
        // 重新渲染饼图
        renderPieChart()
      } catch (e) {
        // 任务获取失败时，保留看板接口返回的数据作为兜底
        console.warn('获取全部任务失败，使用看板接口数据', e)
      }
    } else {
      ElMessage.error('加载失败')
    }
  } catch (err) {
    console.error('仪表盘数据加载失败', err)
    ElMessage.error('请求仪表盘数据失败')
  }
}
onMounted(() => {
  fetchDashboard()
  window.addEventListener('focus-completed', fetchDashboard)
})
// 组件卸载时移除监听
onUnmounted(() => {
  window.removeEventListener('focus-completed', fetchDashboard)
  window.removeEventListener('task-completed', fetchDashboard)
})
const renderBurnDownChart = () => {
  if (!burnDownChart.value || burnDownData.value.length === 0) return
  const chart = echarts.init(burnDownChart.value)
  const dates = burnDownData.value.map(item => item.date)
  const planned = burnDownData.value.map(item => item.planned)
  const actual = burnDownData.value.map(item => item.completed)
  chart.setOption({
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: dates },
    yAxis: { type: 'value', name: '任务数' },
    series: [
      { name: '计划完成', type: 'line', data: planned, lineStyle: { color: '#409EFF' } },
      { name: '实际完成', type: 'line', data: actual, lineStyle: { color: '#67C23A' } }
    ]
  })
}

const renderPieChart = () => {
  if (!pieChart.value) return
  let chart = echarts.getInstanceByDom(pieChart.value)
  if (chart) chart.dispose()
  chart = echarts.init(pieChart.value)
  chart.setOption({
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    series: [{
      type: 'pie',
      radius: '50%',
      data: [
        { value: completedTasks.value, name: '已完成', itemStyle: { color: '#67C23A' } },
        { value: Math.max(totalTasks.value - completedTasks.value, 0), name: '未完成', itemStyle: { color: '#E6A23C' } }
      ]
    }]
  })
}

const submitQuickTask = async () => {
  if (!quickTask.title) {
    ElMessage.warning('请填写任务标题')
    return
  }
  try {
    await request.post('/tasks', {
      ...quickTask,
      userId: localStorage.getItem('userId'),
      status: 0,
      description: ''
    })
    ElMessage.success('添加成功')
    addTaskDialog.value = false
    quickTask.title = ''
    quickTask.deadline = null
    fetchDashboard()
  } catch (err) {
    ElMessage.error('添加失败')
  }
}

const startFocusTimer = () => {
  ElMessage.info('专注计时开始（演示模式）')
}

const toggleTop = async (doc) => {
  // 更新置顶状态（调用后端接口）
  try {
    await request.put(`/documents/${doc.id}/top`, { isTop: doc.isTop ? 1 : 0 })
    ElMessage.success('已更新')
  } catch (err) {
    doc.isTop = !doc.isTop
    ElMessage.error('操作失败')
  }
}

const viewDocument = (id) => {
  router.push('/documents?openDocId=' + id)
}

const showAddTaskDialog = () => {
  addTaskDialog.value = true
}



</script>

<style scoped>
.dashboard-container { padding: 10px; }
.welcome-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 20px;
  border-radius: 12px;
}
.quick-actions {
  display: flex;
  justify-content: flex-end;
  gap: 15px;
  align-items: center;
}
.card-value {
  font-size: 28px;
  font-weight: bold;
  text-align: center;
  margin: 10px 0;
}
.overdue { color: #f56c6c; }
</style>