// 测试 api/index.js 是否能正常工作
console.log('🧪 测试 API 处理器...');

try {
  const apiHandler = require('./api/index.js');
  console.log('✅ API 处理器加载成功:', typeof apiHandler);
  
  if (typeof apiHandler === 'function') {
    console.log('✅ API 处理器是函数 - 可以处理请求');
    
    // 模拟请求和响应
    const mockReq = {
      method: 'GET',
      url: '/',
      headers: {},
      body: {},
    };
    
    const mockRes = {
      status: (code) => ({
        json: (data) => {
          console.log(`📤 响应状态: ${code}, 数据:`, data);
        },
        end: (data) => {
          console.log(`📤 响应状态: ${code}, 数据:`, data);
        }
      }),
      json: (data) => {
        console.log('📤 JSON 响应:', data);
      },
      end: (data) => {
        console.log('📤 响应数据:', data);
      },
      setHeader: () => {},
      writeHead: () => {}
    };
    
    console.log('🔄 测试 API 处理器...');
    apiHandler(mockReq, mockRes);
  } else {
    console.log('❌ API 处理器不是函数:', typeof apiHandler);
  }
} catch (error) {
  console.error('❌ 加载 API 处理器失败:', error.message);
}
