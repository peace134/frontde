<template>
  <el-dialog
      v-model="visible"
      title="🍅 专注计时"
      width="420px"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :show-close="!isRunning"
      @close="handleClose"
  >
    <!-- 设置阶段 -->
    <div v-if="!isRunning">
      <el-form label-width="80px">
        <el-form-item label="任务标题">
          <el-input v-model="title" placeholder="如：刷高数题" maxlength="50" />
        </el-form-item>
        <el-form-item label="专注时长">
          <el-input-number v-model="minutes" :min="1" :max="180" :step="5" />
          <span style="margin-left: 10px">分钟</span>
        </el-form-item>
        <el-form-item label="优先级">
          <el-select v-model="priority" style="width:100%">
            <el-option label="🔴 高优先级" value="high" />
            <el-option label="🟡 中优先级" value="medium" />
            <el-option label="🔵 低优先级" value="low" />
          </el-select>
        </el-form-item>
      </el-form>
      <div style="text-align: center; margin-top: 20px">
        <el-button type="primary" size="large" @click="startTimer" :loading="creating">
          🚀 开始专注
        </el-button>
        <el-button @click="handleClose">取消</el-button>
      </div>
    </div>

    <!-- 计时阶段 -->
    <div v-else class="timer-running">
      <div class="timer-display">{{ formattedTime }}</div>
      <el-progress :percentage="progress" :stroke-width="8" :show-text="false" />
      <div class="timer-task-title">{{ title || '专注中...' }}</div>
      <div style="text-align: center; margin-top: 20px">
        <el-button type="danger" @click="cancelTimer">❌ 取消计时</el-button>
      </div>
    </div>
  </el-dialog>
</template>

<script setup>
import { ref, computed, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { createShortTermTask, startTimer as apiStart, completeTimer as apiComplete, cancelTimer as apiCancel } from '@/api/task'

const emit = defineEmits(['focus-completed', 'task-updated'])

const visible = ref(false)
const title = ref('')
const minutes = ref(25)
const priority = ref('medium')
const isRunning = ref(false)
const creating = ref(false)
const remainingSeconds = ref(0)
const currentTaskId = ref(null)
let timerInterval = null

const userId = localStorage.getItem('userId')

const formattedTime = computed(() => {
  const mins = Math.floor(remainingSeconds.value / 60)
  const secs = remainingSeconds.value % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
})

const progress = computed(() => {
  const total = minutes.value * 60
  const elapsed = total - (remainingSeconds.value > 0 ? remainingSeconds.value : 0)
  return total > 0 ? (elapsed / total) * 100 : 0
})

const openDialog = () => {
  visible.value = true
  resetState()
}

/**
 * 打开计时器并直接开始倒计时（跳过创建，用于列表中已有的短期任务）
 * 注意：TaskView 的 handleStartShortTerm 已调用 apiStart，这里只启动前端倒计时
 * @param {Object} task - 已有的短期任务对象 { id, title, timerMinutes, priority }
 */
const openDialogWithTask = (task) => {
  visible.value = true
  // 只重置倒计时状态，不清除 currentTaskId
  isRunning.value = false
  creating.value = false
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
  // 填充任务数据
  currentTaskId.value = task.id
  title.value = task.title || '专注中...'
  minutes.value = task.timerMinutes || 25
  priority.value = task.priority || 'medium'
  remainingSeconds.value = minutes.value * 60
  // 直接显示倒计时（不调 API，TaskView 已调过 start-timer）
  isRunning.value = true
  timerInterval = setInterval(() => {
    if (remainingSeconds.value <= 0) {
      clearInterval(timerInterval)
      timerInterval = null
      finishTimer()
    } else {
      remainingSeconds.value--
    }
  }, 1000)
}

const resetState = () => {
  isRunning.value = false
  creating.value = false
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
  remainingSeconds.value = minutes.value * 60
  currentTaskId.value = null
}

const startTimer = async () => {
  if (!title.value.trim()) {
    ElMessage.warning('请填写任务标题')
    return
  }
  if (minutes.value <= 0) {
    ElMessage.warning('请设置有效的专注时长')
    return
  }

  creating.value = true
  try {
    // 1. 创建短期任务
    const res = await createShortTermTask({
      userId,
      title: title.value.trim(),
      taskType: 'SHORT_TERM',
      timerMinutes: minutes.value,
      priority: priority.value
    })
    currentTaskId.value = res?.data?.id || res?.id
    if (!currentTaskId.value) {
      throw new Error('创建任务失败，未获取到 taskId')
    }

    // 2. 启动计时器
    await apiStart(currentTaskId.value)

    // 3. 开始前端倒计时
    remainingSeconds.value = minutes.value * 60
    isRunning.value = true
    creating.value = false

    timerInterval = setInterval(() => {
      if (remainingSeconds.value <= 0) {
        clearInterval(timerInterval)
        timerInterval = null
        finishTimer()
      } else {
        remainingSeconds.value--
      }
    }, 1000)
  } catch (err) {
    creating.value = false
    ElMessage.error('启动专注失败，请稍后重试')
  }
}

/**
 * 用于接收已创建的短期任务，直接从 start-timer API 开始
 */
const startExistingTimer = async () => {
 if (!currentTaskId.value) {
   ElMessage.error('任务 ID 无效')
   return
 }
 creating.value = true
 try {
   await apiStart(currentTaskId.value)
   remainingSeconds.value = minutes.value * 60
   isRunning.value = true
   creating.value = false

   timerInterval = setInterval(() => {
     if (remainingSeconds.value <= 0) {
       clearInterval(timerInterval)
       timerInterval = null
       finishTimer()
     } else {
       remainingSeconds.value--
     }
   }, 1000)
 } catch (err) {
   creating.value = false
   ElMessage.error('启动专注失败，请稍后重试')
 }
}

const finishTimer = async () => {
  isRunning.value = false
  const actualMinutes = minutes.value
  try {
    await apiComplete(currentTaskId.value, actualMinutes)
    ElMessage.success(`🎉 专注完成！+${actualMinutes}分钟`)
    emit('focus-completed', { taskId: currentTaskId.value, minutes: actualMinutes })
    emit('task-updated')
    visible.value = false
    window.dispatchEvent(new CustomEvent('focus-completed'))
  } catch (err) {
    ElMessage.error('记录专注时长失败')
  }
}

const cancelTimer = async () => {
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
  isRunning.value = false
  try {
    if (currentTaskId.value) {
      await apiCancel(currentTaskId.value)
    }
  } catch { /* 忽略取消失败 */ }
  ElMessage.info('已取消专注')
  emit('task-updated')
  visible.value = false
}

const handleClose = () => {
  if (isRunning.value) {
    // 点击遮罩层关闭时，不操作；show-close 已设为 false
    return
  }
  visible.value = false
}

defineExpose({ openDialog, openDialogWithTask })

onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval)
})
</script>

<style scoped>
.timer-running {
  text-align: center;
}
.timer-display {
  font-size: 56px;
  font-weight: bold;
  margin: 20px 0;
  font-family: 'Courier New', monospace;
  color: #409EFF;
}
.timer-task-title {
  margin-top: 12px;
  font-size: 16px;
  color: #606266;
}
</style>