import request from '@/utils/request'

export const getTasks = (userId) => request.get('/tasks', { params: { userId } })
export const createTask = (data) => request.post('/tasks', data)
export const updateTaskStatus = (id, status) => request.put(`/tasks/${id}/status`, null, { params: { status } })
export const batchSortTasks = (taskIds) => request.post('/tasks/batch-sort', taskIds)
export const aiDecompose = (goal, subject) => request.post('/tasks/ai/decompose-and-save', { goal, subject })
export const decomposeTask = (taskId, subject) => request.post(`/tasks/${taskId}/ai-decompose`, { subject })
export const getSubtasks = (taskId) => request.get(`/tasks/${taskId}/subtasks`)

export const deleteTask = (id) => request.delete(`/tasks/${id}`)
export const batchCompleteTasks = (taskIds) => request.put('/tasks/batch-complete', taskIds)
export const batchDeleteTasks = (taskIds) => request.delete('/tasks/batch-delete', { data: taskIds })

// 🍅 短期任务 / 专注计时 API
export const createShortTermTask = (data) => request.post('/tasks', data)
export const startTimer = (taskId) => request.post(`/tasks/${taskId}/start-timer`)
export const completeTimer = (taskId, actualMinutes) =>
    request.post(`/tasks/${taskId}/complete-timer?actualMinutes=${actualMinutes}`)
export const cancelTimer = (taskId) => request.post(`/tasks/${taskId}/cancel-timer`)