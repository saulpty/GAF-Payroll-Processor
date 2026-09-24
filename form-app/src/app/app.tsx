import '@/index.css';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import OfferLetterForm from '@/app/pages/OfferLetterForm';
import SuccessPage from '@/app/pages/SuccessPage';

// App: GAF Disciplinary Action
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<OfferLetterForm />} />
        <Route path="/success" element={<SuccessPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
