<template>
  <el-container class="layout-container">
    <!-- 顶部栏 -->
    <el-header class="layout-header">
      <div class="header-left">
        <el-icon class="menu-toggle" @click="toggleSidebar"><Expand /></el-icon>
        <div class="logo">📚 智学轻行</div>
      </div>
      <div class="header-right">
        <!-- 通知图标 -->
        <el-badge :value="unreadCount" :hidden="unreadCount === 0" class="item">
          <el-icon :size="20"><Bell /></el-icon>
        </el-badge>
        <!-- 用户下拉 -->
        <el-dropdown @command="handleCommand">
          <span class="user-dropdown">
            <el-avatar :size="32" :src="userAvatar" />
            <span class="username">{{ nickname || '用户' }}</span>
            <el-icon><ArrowDown /></el-icon>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="profile">个人设置</el-dropdown-item>
              <el-dropdown-item command="logout">退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </el-header>

    <el-container>
      <!-- 侧边栏 (PC) -->
      <el-aside :width="isCollapse ? '64px' : '220px'" class="layout-aside">
        <el-menu
            :default-active="activeMenu"
            class="el-menu-vertical"
            :collapse="isCollapse"
            router
            @select="handleMenuSelect"
        >
          <el-menu-item index="/dashboard">
            <el-icon><Odometer /></el-icon>
            <span>今日看板</span>
          </el-menu-item>
          <el-menu-item index="/tasks">
            <el-icon><List /></el-icon>
            <span>计划与任务</span>
          </el-menu-item>
          <el-menu-item index="/documents">
            <el-icon><Folder /></el-icon>
            <span>资料库</span>
          </el-menu-item>
          <el-menu-item index="/statistics">
            <el-icon><DataLine /></el-icon>
            <span>数据复盘</span>
          </el-menu-item>
          <el-menu-item index="/ai">
            <el-icon><ChatDotRound /></el-icon>
            <span>AI助手</span>
          </el-menu-item>
          <el-menu-item index="/settings">
            <el-icon><Setting /></el-icon>
            <span>设置</span>
          </el-menu-item>
        </el-menu>
      </el-aside>

      <!-- 主内容区 -->
      <el-main class="layout-main">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import request from '@/utils/request'
import {
  Expand, Bell, ArrowDown, Odometer, List, Folder,
  DataLine, ChatDotRound, Setting
} from '@element-plus/icons-vue'

const router = useRouter()
const route = useRoute()
const isCollapse = ref(false)
const unreadCount = ref(0)   // 通知数量，可调用接口获取
//头像
const userAvatar = ref(localStorage.getItem('avatar') || '')
const nickname = ref(localStorage.getItem('nickname') || '')

// 当前激活菜单
const activeMenu = computed(() => route.path)

// 切换侧边栏折叠
const toggleSidebar = () => {
  isCollapse.value = !isCollapse.value
}

// 下拉菜单命令
const handleCommand = (cmd) => {
  if (cmd === 'profile') {
    router.push('/settings?tab=profile')
  } else if (cmd === 'logout') {
    localStorage.clear()
    router.push('/login')
    ElMessage.success('已退出')
  }
}

// 菜单选中（可选）
const handleMenuSelect = (index) => {
  // 可添加埋点
}

// 加载用户信息（模拟，实际从后端获取）
onMounted(() => {
  const storedNickname = localStorage.getItem('nickname')
  if (storedNickname) nickname.value = storedNickname
  const storedAvatar = localStorage.getItem('avatar')
  if (storedAvatar) userAvatar.value = storedAvatar
  loadUserInfo()
  window.addEventListener('avatar-updated', handleAvatarUpdate)
  window.addEventListener('nickname-updated', handleNicknameUpdate)
})

// 监听头像更新事件
const handleAvatarUpdate = (event) => {
  userAvatar.value = event.detail
  localStorage.setItem('avatar', event.detail)
}
const handleNicknameUpdate = (event) => {
  nickname.value = event.detail
  localStorage.setItem('nickname', event.detail)
}

const loadUserInfo = async () => {
  try {
    const res = await request.get('/users/me')
    if (res.success) {
      const avatarUrl = res.data.avatar
      if (avatarUrl) {
        userAvatar.value = avatarUrl + '?t=' + Date.now()
        localStorage.setItem('avatar', avatarUrl)
      }
      if (res.data.nickname) {
        nickname.value = res.data.nickname
        localStorage.setItem('nickname', res.data.nickname)
      }
    }
  } catch (err) {
    console.error('加载用户信息失败', err)
  }
}

onUnmounted(() => {
  window.removeEventListener('avatar-updated', handleAvatarUpdate)
  window.removeEventListener('nickname-updated', handleNicknameUpdate)
})

</script>

<style scoped>
.layout-container {
  height: 100vh;
}
.layout-header {
  background-color: #fff;
  border-bottom: 1px solid #e6e6e6;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 20px;
}
.header-left {
  display: flex;
  align-items: center;
  gap: 20px;
}
.menu-toggle {
  font-size: 20px;
  cursor: pointer;
}
.logo {
  font-size: 18px;
  font-weight: bold;
  color: #409eff;
}
.header-right {
  display: flex;
  align-items: center;
  gap: 20px;
}
.user-dropdown {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}
.username {
  font-size: 14px;
}
.layout-aside {
  background-color: #f5f7fa;
  border-right: 1px solid #e6e6e6;
  transition: width 0.3s;
}
.el-menu-vertical {
  border-right: none;
}
.layout-main {
  background-color: #f0f2f5;
  padding: 20px;
  overflow-y: auto;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
/* 移动端适配 */
@media (max-width: 768px) {
  .layout-aside {
    position: fixed;
    z-index: 100;
    height: 100%;
    transform: translateX(-100%);
    transition: transform 0.3s;
  }
  .layout-aside:not(.collapse) {
    transform: translateX(0);
  }
}
</style>