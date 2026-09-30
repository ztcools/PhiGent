import { createRoot } from 'react-dom/client';
import './index.css';
import './i18n';
import App from './App';
import reportWebVitals from './reportWebVitals';

const container = document.getElementById('root');
const root = createRoot(container!); // 若使用 TypeScript，则写 createRoot(container!)
root.render(<App />);

// 若要开始衡量应用性能，可传入一个函数
// 记录结果（例如 reportWebVitals(console.log)）
// 或发送到分析服务端点。详见 https://bit.ly/CRA-vitals
reportWebVitals();
