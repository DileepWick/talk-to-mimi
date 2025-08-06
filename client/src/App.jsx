import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AllFoods from "./components/foods.jsx";
// import EnhancedVoiceTester from "./components/EnhancedVoiceTester.jsx";
import SocketTest from "./components/socketTest.jsx";

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<AllFoods />} />
        {/* <Route path="/" element={<SocketTest />} /> */}
        {/* <Route path="/test" element={<EnhancedVoiceTester />} /> */}
      </Routes>
    </Router>
  );
};

export default App;