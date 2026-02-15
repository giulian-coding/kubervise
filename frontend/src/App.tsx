import { useState, useEffect } from 'react'
import axios from "axios";
import { Button } from "@/components/ui/button"
import './App.css'

const App: React.FC = () => {
  const [message, setMessage] = useState<boolean>();

  useEffect(() => {
    axios.get("/api/")
      .then(response => setMessage(response.data.message))
      .catch(error => console.error("Error fetching data", error));
  }, []);

      return (
        <div>
          <p>{message === undefined ? "Loading..." : String(message)}</p>
          <Button>Click me</Button>
        </div>
    );
};

export default App
