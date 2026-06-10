<template>
  <div class="statistics-container">
    <div class="page-header">
      <h2>📊 数据复盘</h2>
      <div class="cycle-selector">
        <el-radio-group v-model="cycle" size="default">
          <el-radio-button value="week">本周</el-radio-button>
          <el-radio-button value="month">本月</el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <el-row :gutter="20" class="summary-cards">
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-icon" style="background:#e6f7ff">⏱️</div>
          <div class="stat-info">
            <div class="stat-value">{{ summary.totalFocusMinutes }}<span class="stat-unit">分钟</span></div>
            <div class="stat-label">总专注时长</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-icon" style="background:#f6ffed">✅</div>
          <div class="stat-info">
            <div class="stat-value">{{ summary.completedTasks }}<span class="stat-unit">个</span></div>
            <div class="stat-label">已完成任务</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-icon" style="background:#fff7e6">📋</div>
          <div class="stat-info">
            <div class="stat-value">{{ summary.completionRate }}<span class="stat-unit">%</span></div>
            <div class="stat-label">任务完成率</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-icon" style="background:#fff0f6">📈</div>
          <div class="stat-info">
            <div class="stat-value">{{ summary.avgDailyFocus }}<span class="stat-unit">分钟/天</span></div>
            <div class="stat-label">日均专注</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top:20px">
      <el-col :span="14">
        <el-card shadow="hover" v-loading="loading">
          <template #header>
            <span>📈 每日专注时长趋势</span>
          </template>
          <div ref="focusLineChart" style="height:350px"></div>
          <div v-if="!focusData.dates.length" class="empty-chart">暂无专注数据，去完成一次专注计时吧</div>
        </el-card>
      </el-col>
      <el-col :span="10">
        <el-card shadow="hover" v-loading="loading">
          <template #header>
            <span>🥧 任务分布</span>
          </template>
          <div ref="taskPieChart" style="height:350px"></div>
          <div v-if="!taskPieData.length" class="empty-chart">暂无任务数据</div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top:20px">
      <el-col :span="14">
        <el-card shadow="hover" v-loading="loading">
          <template #header>
            <span>📊 每日任务完成情况</span>
          </template>
          <div ref="taskBarChart" style="height:350px"></div>
          <div v-if="!taskTrendData.dates.length" class="empty-chart">暂无任务数据</div>
        </el-card>
      </el-col>
      <el-col :span="10">
        <el-card shadow="hover" v-loading="loading">
          <template #header>
            <span>🤖 AI 复盘建议</span>
          </template>
          <div class="ai-review">
            <div v-if="aiReview" v-html="formatAI(aiReview)"></div>
            <div v-else class="empty-chart">
              <p>AI 正在分析你的学习数据...</p>
              <p class="ai-tip">完成更多任务和专注计时后，AI 将为你生成个性化复盘建议</p>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import * as echarts from 'echarts'
import request from '@/utils/request'
import { formatAI } from '@/utils/format'

const cycle = ref('week')
watch(cycle, () => {
  loadAllData()
})
const loading = ref(false)
const focusLineChart = ref(null)
const taskPieChart = ref(null)
const taskBarChart = ref(null)

const summary = ref({
  totalFocusMinutes: 0,
  completedTasks: 0,
  completionRate: 0,
  avgDailyFocus: 0
})

const focusData = ref({ dates: [], durations: [] })
const taskTrendData = ref({ dates: [], completed: [], created: [] })
const taskPieData = ref([])
const aiReview = ref('')

const aiReviewLines = computed(() => {
  return aiReview.value ? aiReview.value.split('\n').filter(l => l.trim()) : []
})

const getDaysInCycle = () => {
  if (cycle.value === 'week') return 7
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
}

const loadAllData = async () => {
  loading.value = true
  try {
    const res = await request.get('/statistics', { params: { cycle: cycle.value } })
    if (res && res.success) {
      const data = res.data

      // focusTrend: [{ date: '06/01', minutes: 0 }, ...] → { dates: [...], durations: [...] }
      const ft = data.focusTrend || []
      focusData.value = {
        dates: ft.map(d => d.date),
        durations: ft.map(d => d.minutes || 0)
      }
      // taskTrend: [{ date: '06/01', planned: 0, completed: 0 }, ...] → { dates: [...], completed: [...], created: [...] }
      const tt = data.taskTrend || []
      taskTrendData.value = {
        dates: tt.map(d => d.date),
        completed: tt.map(d => d.completed || 0),
        created: tt.map(d => d.planned || 0)
      }
      aiReview.value = data.aiReview || ''

      const durations = focusData.value.durations
      const totalFocus = data.totalFocusMinutes
        || (durations.length ? durations.reduce((a, b) => a + b, 0) : 0)
      const days = focusData.value.dates.length || getDaysInCycle()

      // === 1. 饼图：按优先级分布（后端返回 taskPriorityData） ===
      if (data.taskPriorityData) {
        taskPieData.value = data.taskPriorityData
      }

      // === 2. 概览卡片：已完成任务 & 完成率 ===
      let completedTasks = data.completedTasks
      let totalTasks = data.totalTasks
      let completionRate = data.completionRate

      if (completedTasks === undefined || totalTasks === undefined || completionRate === undefined) {
        try {
          const userId = localStorage.getItem('userId')
          const taskRes = await request.get('/tasks', { params: { userId } })
          const allTasks = Array.isArray(taskRes) ? taskRes : (taskRes.data || [])

          if (allTasks.length) {
            completedTasks = allTasks.filter(t => t.status === 1 || t.status === 'completed').length
            totalTasks = allTasks.length
            completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

            // 如果后端没返回饼图数据，从任务列表按优先级聚合
            if (!taskPieData.value.length) {
              const priorityLabel = { high: '高优先级', medium: '中优先级', low: '低优先级' }
              const catMap = {}
              allTasks.forEach(t => {
                const cat = priorityLabel[t.priority] || t.priority || '未分类'
                catMap[cat] = (catMap[cat] || 0) + 1
              })
              taskPieData.value = Object.entries(catMap).map(([name, value]) => ({ name, value }))
            }
          }
        } catch {
          // 兜底：用柱状图中已完成列的和
          const completedArr = taskTrendData.value.completed
          completedTasks = completedArr.length ? completedArr.reduce((a, b) => a + b, 0) : 0
          const createdArr = taskTrendData.value.created
          const totalCreated = createdArr.length ? createdArr.reduce((a, b) => a + b, 0) : 0
          totalTasks = completedTasks + totalCreated
          completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
        }
      } else if (!taskPieData.value.length) {
        // 后端有统计数据但没饼图数据，也尝试从 /tasks 获取
        try {
          const userId = localStorage.getItem('userId')
          const taskRes = await request.get('/tasks', { params: { userId } })
          const allTasks = Array.isArray(taskRes) ? taskRes : (taskRes.data || [])
          if (allTasks.length) {
            const priorityLabel = { high: '高优先级', medium: '中优先级', low: '低优先级' }
            const catMap = {}
            allTasks.forEach(t => {
              const cat = priorityLabel[t.priority] || t.priority || '未分类'
              catMap[cat] = (catMap[cat] || 0) + 1
            })
            taskPieData.value = Object.entries(catMap).map(([name, value]) => ({ name, value }))
          }
        } catch { /* 饼图没有数据也不影响主流程 */ }
      }

      summary.value = {
        totalFocusMinutes: totalFocus,
        completedTasks: completedTasks,
        completionRate: completionRate,
        // 后端字段名 avgDailyMinutes
        avgDailyFocus: data.avgDailyMinutes
          || (days > 0 ? Math.round(totalFocus / days) : 0)
      }
    }
  } catch (err) {
    console.error('加载统计数据失败', err)
    summary.value = { totalFocusMinutes: 0, completedTasks: 0, completionRate: 0, avgDailyFocus: 0 }
    focusData.value = { dates: [], durations: [] }
    taskTrendData.value = { dates: [], completed: [], created: [] }
    taskPieData.value = []
    aiReview.value = ''
  } finally {
    loading.value = false
    await nextTick()
    renderCharts()
  }
}

const renderCharts = () => {
  renderFocusLineChart()
  renderTaskBarChart()
  renderTaskPieChart()
}

const renderFocusLineChart = () => {
  if (!focusLineChart.value || !focusData.value.dates.length) return
  let chart = echarts.getInstanceByDom(focusLineChart.value)
  if (chart) chart.dispose()
  chart = echarts.init(focusLineChart.value)
  const isMonth = cycle.value === 'month'
  const len = focusData.value.dates.length
  chart.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: '3%', right: '4%', bottom: isMonth ? '14%' : '3%', top: '5%', containLabel: true },
    xAxis: {
      type: 'category',
      data: focusData.value.dates,
      boundaryGap: false,
      axisLabel: isMonth
        ? { rotate: 45, interval: Math.max(0, Math.floor(len / 10) - 1), fontSize: 11 }
        : {}
    },
    yAxis: { type: 'value', name: '分钟', minInterval: 1 },
    series: [{
      name: '专注时长',
      type: 'line',
      data: focusData.value.durations,
      smooth: true,
      lineStyle: { color: '#409EFF', width: 3 },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(64,158,255,0.3)' },
          { offset: 1, color: 'rgba(64,158,255,0.05)' }
        ])
      },
      symbol: 'circle',
      symbolSize: isMonth ? 4 : 8,
      itemStyle: { color: '#409EFF' }
    }]
  })
}

const renderTaskBarChart = () => {
  if (!taskBarChart.value || !taskTrendData.value.dates.length) return
  let chart = echarts.getInstanceByDom(taskBarChart.value)
  if (chart) chart.dispose()
  chart = echarts.init(taskBarChart.value)
  const isMonth = cycle.value === 'month'
  const len = taskTrendData.value.dates.length
  chart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['已完成', '新建'], bottom: 0 },
    grid: { left: '3%', right: '4%', bottom: isMonth ? '18%' : '12%', top: '8%', containLabel: true },
    xAxis: {
      type: 'category',
      data: taskTrendData.value.dates,
      axisLabel: isMonth
        ? { rotate: 45, interval: Math.max(0, Math.floor(len / 10) - 1), fontSize: 11 }
        : {}
    },
    yAxis: { type: 'value', name: '任务数', minInterval: 1 },
    series: [
      {
        name: '已完成',
        type: 'bar',
        data: taskTrendData.value.completed,
        itemStyle: { color: '#67C23A', borderRadius: [4, 4, 0, 0] },
        barWidth: isMonth ? '60%' : '40%'
      },
      {
        name: '新建',
        type: 'bar',
        data: taskTrendData.value.created,
        itemStyle: { color: '#409EFF', borderRadius: [4, 4, 0, 0] },
        barWidth: isMonth ? '60%' : '40%'
      }
    ]
  })
}

const renderTaskPieChart = () => {
  if (!taskPieChart.value || !taskPieData.value.length) return
  let chart = echarts.getInstanceByDom(taskPieChart.value)
  if (chart) chart.dispose()
  chart = echarts.init(taskPieChart.value)
  // 语义色：高→红 中→橙 低→蓝（与后端返回的 name 匹配）
  const semanticColors = { '高优先级': '#F56C6C', '中优先级': '#E6A23C', '低优先级': '#409EFF' }
  const palette = ['#F56C6C', '#E6A23C', '#409EFF', '#67C23A', '#909399',
                   '#B37FEB', '#36CFC9', '#F2A6B8', '#79BBFF', '#D3ADF7']
  chart.setOption({
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: {
      orient: 'vertical',
      left: 'left',
      top: 'center',
      textStyle: { fontSize: 12 }
    },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      center: ['55%', '50%'],
      avoidLabelOverlap: true,
      data: taskPieData.value.map((item, i) => ({
        name: item.name,
        value: item.value,
        itemStyle: { color: semanticColors[item.name] || palette[i % palette.length] }
      })),
      emphasis: {
        scale: true,
        label: { fontSize: 16, fontWeight: 'bold' }
      },
      label: { show: true, formatter: '{b}\n{d}%', fontSize: 11 }
    }]
  })
}

onMounted(() => {
  loadAllData()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})

const handleResize = () => {
  const charts = [focusLineChart.value, taskBarChart.value, taskPieChart.value]
  charts.forEach(el => {
    if (el) {
      const instance = echarts.getInstanceByDom(el)
      instance?.resize()
    }
  })
}
</script>

<style scoped>
.statistics-container {
  padding: 10px;
}
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.page-header h2 {
  margin: 0;
  font-size: 22px;
  color: #303133;
}
.summary-cards {
  margin-bottom: 10px;
}
.stat-card {
  cursor: default;
}
.stat-card :deep(.el-card__body) {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
}
.stat-icon {
  width: 52px;
  height: 52px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26px;
  flex-shrink: 0;
}
.stat-value {
  font-size: 26px;
  font-weight: bold;
  color: #303133;
  line-height: 1.2;
}
.stat-unit {
  font-size: 14px;
  font-weight: normal;
  color: #909399;
  margin-left: 2px;
}
.stat-label {
  font-size: 13px;
  color: #909399;
  margin-top: 2px;
}
.empty-chart {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 300px;
  color: #909399;
  font-size: 14px;
}
.ai-review {
  min-height: 280px;
  font-size: 14px;
  line-height: 2;
  color: #606266;
  padding: 10px;
}
.ai-review p {
  margin: 8px 0;
}
.ai-tip {
  color: #c0c4cc;
  font-size: 13px;
  margin-top: 12px;
}
</style>