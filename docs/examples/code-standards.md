# 代码规范文档

## 命名规范

### 变量命名

- 使用驼峰命名法 (camelCase)
- 常量使用大写下划线分隔 (UPPER_SNAKE_CASE)
- 避免使用缩写，使用完整的单词

**示例：**

```javascript
// ✅ 正确
const userName = 'john';
const MAX_RETRY_COUNT = 3;

// ❌ 错误
const user_name = 'john';
const maxRetry = 3;
```

### 函数命名

- 使用动词开头，驼峰命名法
- 函数名应该清晰表达其功能

**示例：**

```javascript
// ✅ 正确
function fetchUserData() {}
function validateInput() {}

// ❌ 错误
function getUserData() {}
function input() {}
```

## 代码质量

### 错误处理

- 所有异步操作都应该包含错误处理
- 使用 try-catch 或 Promise.catch() 处理异常

**示例：**

```javascript
// ✅ 正确
async function fetchData() {
  try {
    const response = await fetch('/api/data');
    return await response.json();
  } catch (error) {
    logger.error('Failed to fetch data:', error);
    throw error;
  }
}

// ❌ 错误
async function fetchData() {
  const response = await fetch('/api/data');
  return await response.json();
}
```

### TypeScript 规范

- 所有函数参数和返回值都应该有明确的类型定义
- 避免使用 `any` 类型
- 使用接口定义复杂对象类型

**示例：**

```typescript
// ✅ 正确
interface UserData {
  id: number;
  name: string;
  email: string;
}

function processUser(user: UserData): ProcessedUser {
  // ...
}

// ❌ 错误
function processUser(user: any): any {
  // ...
}
```

## 性能优化

### 避免不必要的计算

- 在循环中避免重复计算
- 使用缓存机制存储计算结果

**示例：**

```javascript
// ✅ 正确
const expensiveCalculation = calculateExpensiveValue();
for (let i = 0; i < items.length; i++) {
  processItem(items[i], expensiveCalculation);
}

// ❌ 错误
for (let i = 0; i < items.length; i++) {
  processItem(items[i], calculateExpensiveValue());
}
```

## 安全规范

### 输入验证

- 所有外部输入都应该进行验证和清理
- 避免直接拼接用户输入到SQL查询或HTML中

**示例：**

```javascript
// ✅ 正确
function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// ❌ 错误
function processUserInput(input: string) {
  const query = `SELECT * FROM users WHERE name = '${input}'`;
  // 直接拼接用户输入，存在SQL注入风险
}
```
