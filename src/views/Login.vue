<template>
  <div class="login-container">
    <el-card class="login-card">
      <h2>智学轻行 · 登录</h2>
      <el-form :model="form" label-width="80px">
        <el-form-item label="用户名">
          <el-input v-model="form.username" autocomplete="off" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input type="password" v-model="form.password" />
        </el-form-item>
        <el-form-item label=" ">
          <div class="btn-group">
            <el-button type="primary" @click="handleLogin">登录</el-button>
            <el-button @click="$router.push('/register')">注册账号</el-button>
          </div>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import request from '@/utils/request'

const router = useRouter()
const form = reactive({ username: '', password: '' })

const handleLogin = async () => {
  try {
    const res = await request.post('/users/login', form)
    if (res.success) {
      localStorage.setItem('token', res.token)
      localStorage.setItem('userId', res.userId)
      if (res.avatar) localStorage.setItem('avatar', res.avatar)
      if (res.nickname) localStorage.setItem('nickname', res.nickname)
      ElMessage.success('登录成功')
      router.push('/dashboard')
    } else {
      ElMessage.error(res.message || '登录失败')
    }
  } catch (err) {
    ElMessage.error('请求失败，请确保后端已启动')
  }
}
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background: #f0f2f5;
}
.login-card {
  width: 400px;
}
.btn-group {
  display: flex;
  gap: 12px;
  width: 100%;
}
.btn-group .el-button {
  flex: 1;
}
</style>