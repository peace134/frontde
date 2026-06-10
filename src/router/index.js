import { createRouter, createWebHashHistory } from 'vue-router'
import Login from '@/views/Login.vue'
import Register from '@/views/Register.vue'
import MainLayout from '@/layouts/MainLayout.vue'

// 各个页面组件
import Dashboard from '@/views/Dashboard.vue'
import TaskView from '@/views/TaskView.vue'
import DocumentView from '@/views/DocumentView.vue'
import StatisticsView from '@/views/StatisticsView.vue'
import AIAssistant from '@/views/AIAssistant.vue'
import Settings from '@/views/Settings.vue'

const routes = [
    { path: '/', redirect: '/login' },
    { path: '/login', component: Login },
    { path: '/register', component: Register },
    {
        path: '/',
        component: MainLayout,
        meta: { requiresAuth: true },
        children: [
            { path: 'dashboard', component: Dashboard, meta: { title: '今日看板' } },
            { path: 'tasks', component: TaskView, meta: { title: '计划与任务' } },
            { path: 'documents', component: DocumentView, meta: { title: '资料库' } },
            { path: 'statistics', component: StatisticsView, meta: { title: '数据复盘' } },
            { path: 'ai', component: AIAssistant, meta: { title: 'AI助手' } },
            { path: 'settings', component: Settings, meta: { title: '设置' } }
        ]
    }
]

const router = createRouter({
    history: createWebHashHistory(),
    routes
})

router.beforeEach((to, from, next) => {
    const token = localStorage.getItem('token')
    if (to.meta.requiresAuth && !token) {
        next('/login')
    } else {
        next()
    }
})

export default router