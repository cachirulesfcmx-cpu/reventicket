import { useLocation } from "wouter";
import { useEffect } from "react";

export default function Register() {
  const [, navigate] = useLocation();
  
  useEffect(() => {
    navigate("/login");
  }, [navigate]);

  return null;
}
