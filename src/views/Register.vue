<template>
  <div class="register-container">
    <el-card class="register-card">
      <h2>注册账号</h2>
      <el-form :model="form">
        <el-form-item label="用户名">
          <el-input v-model="form.username" />
        </el-form-item>
        <el-form-item label="昵称">
          <el-input v-model="form.nickname" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input type="password" v-model="form.password" />
        </el-form-item>
        <el-button type="primary" @click="handleRegister" style="width:100%">注册</el-button>
        <el-button @click="$router.push('/login')" style="width:100%; margin-top:10px">返回登录</el-button>
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
const form = reactive({ username: '', nickname: '', password: '' })

const handleRegister = async () => {
  try {
    const res = await request.post('/users/register', form)
    if (res.success) {
      ElMessage.success('注册成功，请登录')
      router.push('/login')
    } else {
      ElMessage.error(res.message || '注册失败')
    }
  } catch (err) {
    ElMessage.error('请求失败')
  }
}
</script>

<style scoped>
.register-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
}
.register-card {
  width: 400px;
}
</style>