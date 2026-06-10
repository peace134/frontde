<template>
  <div>
    <!-- Tab 切换 -->
    <el-tabs v-model="activeTab" type="card" @tab-change="onTabChange">
      <el-tab-pane label="📋 长期任务" name="longterm">
        <template #label>
          <span>📋 长期任务</span>
        </template>
      </el-tab-pane>
      <el-tab-pane label="🍅 短期任务" name="shortterm">
        <template #label>
          <span>🍅 短期任务</span>
        </template>
      </el-tab-pane>
    </el-tabs>

    <!-- =========== 长期任务面板 =========== -->
    <div v-show="activeTab === 'longterm'">
      <div style="margin-bottom: 20px; display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
        <el-input v-model="goal" placeholder="输入学习目标，AI自动拆解" style="width:280px">
          <template #append>
            <el-button @click="handleAIDecompose" :loading="aiLoading">AI拆解</el-button>
          </template>
        </el-input>
        <el-input v-model="decomposeSubject" placeholder="学科分类（如：计算机）" style="width:170px" clearable />
        <el-button type="primary" @click="dialogVisible = true">+ 新建任务</el-button>
      </div>

      <!-- 长期任务列表 -->
      <div ref="taskListRef" class="task-list" v-if="tasks.length">
        <div v-for="(task, index) in tasks" :key="task.id" class="task-item" :data-id="task.id">
          <div class="task-item-main">
            <el-checkbox v-model="selectedLongTermIds" :label="task.id" size="small" class="select-checkbox" @click.stop>
            </el-checkbox>
            <span class="task-index">{{ index + 1 }}.</span>
            <el-checkbox v-model="task.status" :true-label="1" :false-label="0" @change="toggleStatus(task)">
              {{ task.title }}
            </el-checkbox>
            <el-tag :type="priorityType(task.priority)" size="small" style="margin-left: 10px">{{ priorityLabel(task.priority) }}</el-tag>
            <span style="margin-left: 10px">截止: {{ task.deadline ? new Date(task.deadline).toLocaleDateString() : '无' }}</span>
            <div style="float:right">
              <el-button size="small" type="warning" plain @click.stop="handleAIDecomposeTask(task)" :loading="decomposingTaskId === task.id">🤖 拆解</el-button>
              <el-icon style="cursor:pointer; margin-left:8px" @click="deleteTaskHandler(task.id)">
                <Delete />
              </el-icon>
            </div>
          </div>
          <!-- 子任务列表（拆解结果，parentId = 该任务ID） -->
          <div v-if="subtaskMap[task.id] && subtaskMap[task.id].length" class="subtask-list">
            <div class="subtask-title">📎 子任务 ({{ subtaskMap[task.id].length }})</div>
            <div v-for="sub in subtaskMap[task.id]" :key="sub.id" class="subtask-item">
              <el-checkbox v-model="sub.status" :true-label="1" :false-label="0" size="small" @change="toggleStatus(sub)">
                {{ sub.title }}
              </el-checkbox>
              <el-tag v-if="sub.priority" :type="priorityType(sub.priority)" size="mini" style="margin-left:8px">{{ priorityLabel(sub.priority) }}</el-tag>
              <el-tag v-if="sub.timerMinutes" type="info" size="mini" style="margin-left:4px">⏱️ {{ sub.timerMinutes }}分钟</el-tag>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="empty-tasks">暂无长期任务，点击上方按钮创建</div>

      <!-- 图表 -->
      <div id="ganttChart" style="width:100%; height:300px; margin-top:30px" v-if="tasks.length"></div>
      <div v-else class="empty-chart">暂无数据，添加任务后可查看图表</div>

      <div class="batch-actions">
        <el-button type="success" @click="batchCompleteTasks" :loading="batchLoading">✅ 一键完成未完成任务</el-button>
        <el-button type="danger" @click="handleBatchDelete(tasks, selectedLongTermIds, '长期')" :disabled="!selectedLongTermIds.length">
          🗑️ 批量删除（{{ selectedLongTermIds.length }}）
        </el-button>
      </div>
    </div>

    <!-- =========== 短期任务面板 =========== -->
    <div v-show="activeTab === 'shortterm'">
      <div style="margin-bottom: 20px; display: flex; gap: 10px">
        <el-button type="warning" @click="showCreateShortTerm = true">🍅 新建短期任务</el-button>
        <el-button type="success" @click="focusTimerRef?.openDialog()">⏱️ 打开计时器</el-button>
        <el-button type="danger" @click="handleBatchDelete(shortTermTasks, selectedShortTermIds, '短期')" :disabled="!selectedShortTermIds.length">
          🗑️ 批量删除（{{ selectedShortTermIds.length }}）
        </el-button>
      </div>

      <!-- 短期任务列表 -->
      <div v-if="shortTermTasks.length" class="short-term-list">
        <el-card
            v-for="(task, index) in shortTermTasks"
            :key="task.id"
            class="short-term-card"
            shadow="hover"
        >
          <div class="short-term-header">
            <el-checkbox v-model="selectedShortTermIds" :label="task.id" size="small" class="select-checkbox" @click.stop>
            </el-checkbox>
            <span class="task-index">{{ index + 1 }}.</span>
            <span class="short-term-title">{{ task.title }}</span>
            <el-tag :type="priorityType(task.priority)" size="small">{{ priorityLabel(task.priority) }}</el-tag>
            <el-tag v-if="task.timerMinutes" type="info" size="small">⏱️ {{ task.timerMinutes }}分钟</el-tag>
          </div>
          <div class="short-term-actions">
            <!-- 未开始 -->
            <template v-if="!task.timerStatus || task.timerStatus === 'created'">
              <el-button type="primary" size="small" @click="handleStartShortTerm(task)">🟢 开始</el-button>
              <el-button size="small" @click="deleteTaskHandler(task.id)">删除</el-button>
            </template>
            <!-- 进行中 -->
            <template v-else-if="task.timerStatus === 'running'">
              <el-tag type="primary">⏳ 进行中</el-tag>
              <el-button type="primary" size="small" @click="openFocusTimerDialog(task)">👉 查看计时</el-button>
              <el-button type="danger" size="small" @click="handleCancelShortTerm(task)">❌ 取消</el-button>
            </template>
            <!-- 已完成 -->
            <template v-else-if="task.timerStatus === 'completed'">
              <el-tag type="success">✅ 已完成</el-tag>
              <span class="actual-minutes">实际 {{ task.actualMinutes || task.timerMinutes }}分钟</span>
            </template>
            <!-- 已取消 -->
            <template v-else-if="task.timerStatus === 'cancelled'">
              <el-tag type="info">已取消</el-tag>
            </template>
          </div>
        </el-card>
      </div>
      <div v-else class="empty-tasks">暂无短期任务，点击上方按钮创建</div>
    </div>

    <!-- 新建长期任务弹窗 -->
    <el-dialog v-model="dialogVisible" title="新建长期任务" width="500px">
      <el-form :model="newTask" label-width="80px">
        <el-form-item label="标题">
          <el-input v-model="newTask.title" />
        </el-form-item>
        <el-form-item label="优先级">
          <el-select v-model="newTask.priority">
            <el-option label="高" value="high" />
            <el-option label="中" value="medium" />
            <el-option label="低" value="low" />
          </el-select>
        </el-form-item>
        <el-form-item label="截止时间">
          <el-date-picker v-model="newTask.deadline" type="datetime" placeholder="选择日期时间" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="newTask.description" type="textarea" rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="addTask">确定</el-button>
      </template>
    </el-dialog>

    <!-- 新建短期任务弹窗 -->
    <el-dialog v-model="showCreateShortTerm" title="🍅 新建短期任务" width="450px">
      <el-form :model="shortTermForm" label-width="90px">
        <el-form-item label="任务标题">
          <el-input v-model="shortTermForm.title" placeholder="如：刷高数题" />
        </el-form-item>
        <el-form-item label="专注时长">
          <el-input-number v-model="shortTermForm.timerMinutes" :min="1" :max="180" :step="5" />
          <span style="margin-left: 10px">分钟</span>
        </el-form-item>
        <el-form-item label="优先级">
          <el-select v-model="shortTermForm.priority" style="width:100%">
            <el-option label="🔴 高优先级" value="high" />
            <el-option label="🟡 中优先级" value="medium" />
            <el-option label="🔵 低优先级" value="low" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateShortTerm = false">取消</el-button>
        <el-button type="warning" @click="createShortTermTask" :loading="creatingShortTerm">🍅 创建并开始</el-button>
      </template>
    </el-dialog>

    <!-- 专注计时器组件（复用弹窗模式） -->
    <FocusTimer ref="focusTimerRef" @task-updated="fetchShortTermTasks" />
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, computed } from 'vue'
import {
  getTasks, createTask, updateTaskStatus, batchSortTasks,
  aiDecompose, decomposeTask, getSubtasks,
  deleteTask, batchCompleteTasks as apiBatchComplete, batchDeleteTasks,
  createShortTermTask as apiCreateShort, startTimer as apiStart,
  completeTimer as apiComplete, cancelTimer as apiCancel
} from '@/api/task'
import { Delete } from '@element-plus/icons-vue'
import Sortable from 'sortablejs'
import * as echarts from 'echarts'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '@/utils/request'
import FocusTimer from '@/components/FocusTimer.vue'

const userId = localStorage.getItem('userId')

// === 长期任务 ===
const tasks = ref([])
const goal = ref('')
const decomposeSubject = ref('')
const aiLoading = ref(false)
const dialogVisible = ref(false)
const taskListRef = ref(null)
const newTask = ref({ title: '', priority: 'medium', deadline: null, description: '' })
const batchLoading = ref(false)

// === AI 拆分子任务 ===
const subtaskMap = ref({})
const decomposingTaskId = ref(null)

// === 批量选择 ===
const selectedLongTermIds = ref([])
const selectedShortTermIds = ref([])

// === 短期任务 ===
const shortTermTasks = ref([])
const showCreateShortTerm = ref(false)
const creatingShortTerm = ref(false)
const shortTermForm = ref({ title: '', timerMinutes: 25, priority: 'medium' })
const focusTimerRef = ref(null)



// Tab 切换
const activeTab = ref('longterm')

const onTabChange = (name) => {
  if (name === 'shortterm') {
    fetchShortTermTasks()
  } else if (name === 'longterm') {
    fetchTasks()
  }
}

// === 长期任务 API ===
const fetchTasks = async () => {
  try {
    const res = await getTasks(userId)
    // 只显示非短期任务（普通任务）
    const all = Array.isArray(res) ? res : (res?.data || [])
    tasks.value = all.filter(t => t.taskType !== 'SHORT_TERM')
    await nextTick()
    renderChart()
    initSortable()
    // 为所有长期任务获取子任务（有则显示，无则隐藏）
    const subtaskPromises = tasks.value.map(t => fetchSubtasks(t.id))
    await Promise.all(subtaskPromises)
  } catch (err) {
    console.error('加载任务失败', err)
    ElMessage.error('加载任务失败')
  }
}

const renderChart = () => {
  const chartDom = document.getElementById('ganttChart')
  if (!chartDom || tasks.value.length === 0) return
  let chart = echarts.getInstanceByDom(chartDom)
  if (chart) chart.dispose()
  chart = echarts.init(chartDom)
  const today = new Date()
  const days = tasks.value.map(t => {
    if (!t.deadline) return 0
    const diff = Math.ceil((new Date(t.deadline) - today) / (1000 * 60 * 60 * 24))
    return diff > 0 ? diff : 0
  })
  chart.setOption({
    title: { text: '任务剩余天数分布' },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: tasks.value.map(t => t.title), axisLabel: { rotate: 30 } },
    yAxis: { type: 'value', name: '剩余天数' },
    series: [{ type: 'bar', data: days, itemStyle: { color: '#409EFF' } }]
  })
}

const initSortable = () => {
  const el = taskListRef.value
  if (!el || tasks.value.length === 0) return
  if (el.sortableInstance) el.sortableInstance.destroy()
  new Sortable(el, {
    animation: 150,
    onEnd: async () => {
      const newOrder = tasks.value.map(t => t.id)
      await batchSortTasks(newOrder)
    }
  })
}

const toggleStatus = async (task) => {
  try {
    await updateTaskStatus(task.id, task.status)
    ElMessage.success('状态已更新')
    fetchTasks()
    window.dispatchEvent(new CustomEvent('task-completed'))
  } catch {
    ElMessage.error('状态更新失败')
  }
}

const addTask = async () => {
  try {
    await createTask({ ...newTask.value, userId })
    ElMessage.success('添加成功')
    dialogVisible.value = false
    newTask.value = { title: '', priority: 'medium', deadline: null, description: '' }
    fetchTasks()
  } catch {
    ElMessage.error('添加失败')
  }
}

const deleteTaskHandler = async (id) => {
  try {
    await ElMessageBox.confirm('确定删除该任务吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await deleteTask(id)
    ElMessage.success('删除成功')
    fetchTasks()
    fetchShortTermTasks()
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

const handleAIDecompose = async () => {
  if (!goal.value.trim()) {
    ElMessage.warning('请输入学习目标')
    return
  }
  if (!decomposeSubject.value.trim()) {
    ElMessage.warning('请输入学科分类')
    return
  }
  aiLoading.value = true
  try {
    const res = await aiDecompose(goal.value.trim(), decomposeSubject.value.trim())
    // res.data 已经是保存好的任务数组
    const tasks = Array.isArray(res) ? res : (res?.data || [])
    ElMessage.success(`🎯 AI 已拆解并保存 ${tasks.length} 个任务`)
    goal.value = ''
    decomposeSubject.value = ''
    fetchTasks()
  } catch (err) {
    ElMessage.error('AI拆解失败，请稍后重试')
  } finally {
    aiLoading.value = false
  }
}

// 🤖 对单个长期任务进行 AI 拆解（生成子任务，parentId = 当前任务）
const handleAIDecomposeTask = async (task) => {
  try {
    const { value: subject } = await ElMessageBox.prompt(
      `对「${task.title}」进行 AI 拆解，请输入学科分类`,
      '🤖 AI 拆解任务',
      {
        confirmButtonText: '开始拆解',
        cancelButtonText: '取消',
        inputPlaceholder: '如：计算机、数学、英语',
        inputPattern: /.+/,
        inputErrorMessage: '学科分类不能为空'
      }
    )
    decomposingTaskId.value = task.id
    const res = await decomposeTask(task.id, subject)
    ElMessage.success(`🎯 拆解完成！正在加载子任务...`)
    // 拆解成功后刷新任务列表及其子任务
    await fetchTasks()
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error('AI拆解失败，请稍后重试')
    }
  } finally {
    decomposingTaskId.value = null
  }
}

// 获取某个长期任务下的子任务列表
const fetchSubtasks = async (parentId) => {
  try {
    const res = await getSubtasks(parentId)
    const list = Array.isArray(res) ? res : (res?.data || [])
    subtaskMap.value = { ...subtaskMap.value, [parentId]: list }
  } catch {
    // 静默处理
  }
}

const batchCompleteTasks = async () => {
  const unfinishedTasks = tasks.value.filter(t => t.status === 0)
  if (unfinishedTasks.length === 0) {
    ElMessage.info('当前没有未完成的任务')
    return
  }
  try {
    await ElMessageBox.confirm(`确认完成全部 ${unfinishedTasks.length} 个未完成任务吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'info'
    })
    batchLoading.value = true
    const taskIds = unfinishedTasks.map(t => t.id)
    await apiBatchComplete(taskIds)
    ElMessage.success('已批量完成任务')
    fetchTasks()
    window.dispatchEvent(new CustomEvent('task-completed'))
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error('批量完成失败')
    }
  } finally {
    batchLoading.value = false
  }
}

// 🗑️ 批量删除任务（长期任务会级联删除子任务）
const handleBatchDelete = async (taskList, selectedIds, typeName) => {
  if (!selectedIds.length) return
  try {
    await ElMessageBox.confirm(
      `确定删除选中的 ${selectedIds.length} 个${typeName}任务吗？删除后不可恢复。`,
      '⚠️ 批量删除',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    await batchDeleteTasks(selectedIds)
    ElMessage.success(`已删除 ${selectedIds.length} 个${typeName}任务`)
    selectedIds.length = 0
    fetchTasks()
    fetchShortTermTasks()
  } catch (err) {
    if (err !== 'cancel') ElMessage.error('批量删除失败')
  }
}

// === 短期任务 API ===
const fetchShortTermTasks = async () => {
  try {
    const res = await getTasks(userId)
    const all = Array.isArray(res) ? res : (res?.data || [])
    shortTermTasks.value = all.filter(t => t.taskType === 'SHORT_TERM')
  } catch {
    // 忽略
  }
}

const createShortTermTask = async () => {
  if (!shortTermForm.value.title.trim()) {
    ElMessage.warning('请填写任务标题')
    return
  }
  creatingShortTerm.value = true
  try {
    await apiCreateShort({
      userId,
      title: shortTermForm.value.title.trim(),
      taskType: 'SHORT_TERM',
      timerMinutes: shortTermForm.value.timerMinutes,
      priority: shortTermForm.value.priority
    })
    ElMessage.success('创建成功')
    showCreateShortTerm.value = false
    shortTermForm.value = { title: '', timerMinutes: 25, priority: 'medium' }
    fetchShortTermTasks()
  } catch {
    ElMessage.error('创建失败')
  } finally {
    creatingShortTerm.value = false
  }
}

const handleStartShortTerm = async (task) => {
  try {
    await apiStart(task.id)
    ElMessage.success('⏱️ 计时已开始，打开弹窗倒计时')
    fetchShortTermTasks()
    openFocusTimerDialog(task)
  } catch {
    ElMessage.error('启动失败')
  }
}

// 打开弹窗查看/继续计时
const openFocusTimerDialog = (task) => {
  // FocusTimer 会处理倒计时和 API 调用
  focusTimerRef.value.openDialogWithTask(task)
}

const handleCancelShortTerm = async (task) => {
  try {
    await apiCancel(task.id)
    ElMessage.info('已取消专注')
    fetchShortTermTasks()
  } catch {
    ElMessage.error('取消失败')
  }
}

const priorityLabel = (p) => {
  const map = { high: '高', medium: '中', low: '低' }
  return map[p] || p
}

const priorityType = (priority) => {
  if (priority === 'high') return 'danger'
  if (priority === 'medium') return 'warning'
  return 'info'
}

onMounted(() => {
  fetchTasks()
})
</script>

<style scoped>
.task-list {
  border: 1px solid #ebeef5;
  border-radius: 4px;
  min-height: 300px;
}
.task-item {
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
  cursor: move;
}
.task-item:hover {
  background-color: #f5f7fa;
}
.task-item-main {
  display: flex;
  align-items: center;
  gap: 8px;
}
.select-checkbox {
  margin-right: 4px;
}
.select-checkbox :deep(.el-checkbox__label) {
  display: none;
}
.task-index {
  min-width: 24px;
  font-weight: 600;
  color: #909399;
  font-size: 14px;
  user-select: none;
}
.batch-actions {
  margin-top: 12px;
  display: flex;
  gap: 10px;
}
.empty-tasks, .empty-chart {
  text-align: center;
  color: #999;
  padding: 40px;
}
.subtask-list {
  margin: 8px 0 0 28px;
  padding: 8px 12px;
  background: #fafafa;
  border-left: 3px solid #E6A23C;
  border-radius: 4px;
}
.subtask-title {
  font-size: 12px;
  color: #909399;
  margin-bottom: 6px;
}
.subtask-item {
  padding: 4px 0;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}
.subtask-list {
  margin: 8px 0 0 28px;
  padding: 8px 12px;
  background: #fafafa;
  border-left: 3px solid #E6A23C;
  border-radius: 4px;
}
.subtask-title {
  font-size: 12px;
  color: #909399;
  margin-bottom: 6px;
}
.subtask-item {
  padding: 4px 0;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}
.subtask-list {
  margin: 8px 0 0 28px;
  padding: 8px 12px;
  background: #fafafa;
  border-left: 3px solid #E6A23C;
  border-radius: 4px;
}
.subtask-title {
  font-size: 12px;
  color: #909399;
  margin-bottom: 6px;
}
.subtask-item {
  padding: 4px 0;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}
.subtask-list {
  margin: 8px 0 0 28px;
  padding: 8px 12px;
  background: #fafafa;
  border-left: 3px solid #E6A23C;
  border-radius: 4px;
}
.subtask-title {
  font-size: 12px;
  color: #909399;
  margin-bottom: 6px;
}
.subtask-item {
  padding: 4px 0;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}
.subtask-list {
  margin: 8px 0 0 28px;
  padding: 8px 12px;
  background: #fafafa;
  border-left: 3px solid #E6A23C;
  border-radius: 4px;
}
.subtask-title {
  font-size: 12px;
  color: #909399;
  margin-bottom: 6px;
}
.subtask-item {
  padding: 4px 0;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}
.short-term-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.short-term-card {
  border-left: 4px solid #E6A23C;
}
.short-term-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.short-term-title {
  font-weight: bold;
  font-size: 15px;
}
.short-term-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.actual-minutes {
  font-size: 13px;
  color: #909399;
}
</style>