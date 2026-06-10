<template>
  <div class="settings-container">
    <el-tabs v-model="activeTab">
      <el-tab-pane label="个人资料" name="profile">
        <el-form :model="profileForm" label-width="100px">
          <el-form-item label="头像">
            <div class="avatar-upload">
              <el-avatar :size="80" :src="avatarPreview" />
              <div class="upload-actions">
                <el-upload
                    class="upload-btn"
                    action="/api/users/avatar"
                    :headers="{ Authorization: `Bearer ${token}` }"
                    :show-file-list="false"
                    :on-success="handleAvatarSuccess"
                    :on-error="handleAvatarError"
                    :before-upload="beforeAvatarUpload"
                    accept="image/jpeg,image/png,image/gif"
                >
                  <el-button type="primary" :loading="uploading">更换头像</el-button>
                </el-upload>
                <el-button v-if="avatarPreview" type="danger" plain @click="removeAvatar">移除头像</el-button>
              </div>
            </div>
          </el-form-item>
          <el-form-item label="昵称">
            <el-input v-model="profileForm.nickname" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="saveProfile">保存</el-button>
          </el-form-item>
        </el-form>
      </el-tab-pane>
      <el-tab-pane label="偏好设置" name="pref">
        <el-form>
          <el-form-item label="学科偏好">
            <el-select v-model="pref.subject" multiple placeholder="选择学科">
              <el-option label="数学" value="math" />
              <el-option label="语文" value="chinese" />
              <el-option label="英语" value="english" />
            </el-select>
          </el-form-item>
          <el-form-item label="提醒时间">
            <el-time-picker v-model="pref.remindTime" placeholder="选择时间" />
          </el-form-item>
          <el-form-item label="统计周期">
            <el-radio-group v-model="pref.statCycle">
              <el-radio value="week">周</el-radio>
              <el-radio value="month">月</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="savePref">保存</el-button>
          </el-form-item>
        </el-form>
      </el-tab-pane>
      <el-tab-pane label="账号安全" name="security">
        <el-form :model="pwdForm" label-width="100px" ref="pwdFormRef" :rules="pwdRules">
          <el-form-item label="原密码" prop="oldPassword">
            <el-input type="password" v-model="pwdForm.oldPassword" placeholder="请输入原密码" show-password />
          </el-form-item>
          <el-form-item label="新密码" prop="newPassword">
            <el-input type="password" v-model="pwdForm.newPassword" placeholder="请输入新密码（6-16位字母数字组合）" show-password />
          </el-form-item>
          <el-form-item label="确认新密码" prop="confirmPassword">
            <el-input type="password" v-model="pwdForm.confirmPassword" placeholder="请再次输入新密码" show-password />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="changePwd" :loading="pwdLoading">确认修改</el-button>
          </el-form-item>
        </el-form>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import request from '@/utils/request'
import { useRouter } from 'vue-router'

const router = useRouter()
const token = localStorage.getItem('token')
const activeTab = ref('profile')
const profileForm = reactive({ nickname: '' })
const avatarPreview = ref('')
const uploading = ref(false)
const pref = reactive({ subject: [], remindTime: null, statCycle: 'week' })
const pwd = reactive({ old: '', new: '' })

// 加载当前用户信息
const loadUserInfo = async () => {
  try {
    const res = await request.get('/users/me')
    if (res.success) {
      profileForm.nickname = res.data.nickname || ''
      avatarPreview.value = res.data.avatar || ''   // 关键：确保这里拿到正确的 URL
    }
  } catch (err) {
    ElMessage.error('加载用户信息失败')
  }
}

// 头像上传前校验
const beforeAvatarUpload = (file) => {
  const isImage = file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/gif'
  const isLt2M = file.size / 1024 / 1024 < 2
  if (!isImage) {
    ElMessage.error('只能上传 JPG/PNG/GIF 格式')
    return false
  }
  if (!isLt2M) {
    ElMessage.error('头像大小不能超过 2MB')
    return false
  }
  uploading.value = true
  return true
}

// 头像上传失败回调
const handleAvatarError = () => {
  uploading.value = false
  ElMessage.error('头像上传失败，请稍后再试')
}

// 头像上传成功回调
const handleAvatarSuccess = (response, uploadFile) => {
  uploading.value = false
  try {
    if (typeof response === 'string') {
      response = JSON.parse(response)
    }
  } catch (e) {
    ElMessage.error('服务器响应格式异常')
    return
  }
  if (response && response.success) {
    const avatarUrl = response.data
    avatarPreview.value = avatarUrl + '?t=' + Date.now()
    ElMessage.success('头像更新成功')
    localStorage.setItem('avatar', avatarUrl)
    window.dispatchEvent(new CustomEvent('avatar-updated', { detail: avatarUrl }))
  } else {
    ElMessage.error((response && response.message) || '上传失败')
  }
}

// 移除头像
const removeAvatar = async () => {
  try {
    const res = await request.delete('/users/avatar')
    if (res.success) {
      avatarPreview.value = ''
      localStorage.removeItem('avatar')
      window.dispatchEvent(new CustomEvent('avatar-updated', { detail: '' }))
      ElMessage.success('头像已移除')
    } else {
      ElMessage.error(res.message || '移除失败')
    }
  } catch (err) {
    ElMessage.error('请求失败，请稍后再试')
  }
}
// 保存个人资料（昵称）
const saveProfile = async () => {
  try {
    await request.put('/users/profile', { nickname: profileForm.nickname })
    ElMessage.success('保存成功')
    localStorage.setItem('nickname', profileForm.nickname)
    // 通知顶部栏刷新昵称
    window.dispatchEvent(new CustomEvent('nickname-updated', { detail: profileForm.nickname }))
  } catch (err) {
    ElMessage.error('保存失败')
  }
}

// 密码表单
const pwdForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})
const pwdLoading = ref(false)
const pwdFormRef = ref(null)

// 自定义校验函数
const validateNewPassword = (rule, value, callback) => {
  if (!value) {
    callback(new Error('请输入新密码'))
  } else if (value.length < 6 || value.length > 16) {
    callback(new Error('密码长度应为6-16位'))
  } else if (!/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,16}$/.test(value)) {
    callback(new Error('密码必须包含字母和数字'))
  } else {
    callback()
  }
}

const validateConfirm = (rule, value, callback) => {
  if (!value) {
    callback(new Error('请再次输入新密码'))
  } else if (value !== pwdForm.newPassword) {
    callback(new Error('两次输入的新密码不一致'))
  } else {
    callback()
  }
}

// 密码表单校验规则
const pwdRules = {
  oldPassword: [
    { required: true, message: '请输入原密码', trigger: 'blur' }
  ],
  newPassword: [
    { required: true, validator: validateNewPassword, trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, validator: validateConfirm, trigger: 'blur' }
  ]
}

// 修改密码方法
const changePwd = async () => {
  if (!pwdFormRef.value) return
  await pwdFormRef.value.validate(async (valid) => {
    if (!valid) return
    pwdLoading.value = true
    try {
      const res = await request.put('/users/password', {
        oldPassword: pwdForm.oldPassword,
        newPassword: pwdForm.newPassword
      })
      if (res.success) {
        ElMessage.success('密码修改成功，请重新登录')
        // 清除本地登录信息，退出到登录页
        localStorage.clear()
        setTimeout(() => {
          router.push('/login')
        }, 1500)
      } else {
        ElMessage.error(res.message || '修改失败，请检查原密码')
      }
    } catch (err) {
      ElMessage.error('请求失败，请稍后再试')
    } finally {
      pwdLoading.value = false
      // 清空表单
      pwdForm.oldPassword = ''
      pwdForm.newPassword = ''
      pwdForm.confirmPassword = ''
      pwdFormRef.value?.clearValidate()
    }
  })
}

const savePref = () => {
  ElMessage.success('偏好已保存（后端接口待实现）')
}



onMounted(() => {
  loadUserInfo()
})
</script>

<style scoped>
.settings-container {
  background: white;
  padding: 20px;
  border-radius: 8px;
}
.avatar-upload {
  display: flex;
  align-items: center;
  gap: 20px;
}
.upload-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.upload-btn {
  display: inline-block;
}
</style>