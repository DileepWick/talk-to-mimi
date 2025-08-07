import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import FoodMenu from "./components/FoodMenu";

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<FoodMenu />} />
      </Routes>
    </Router>
  );
};

export default App;