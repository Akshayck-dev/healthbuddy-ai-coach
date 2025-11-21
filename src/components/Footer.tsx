import { Heart } from "lucide-react";
import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="bg-secondary text-secondary-foreground py-12 mt-20">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex items-center gap-2 font-bold text-xl">
            <Heart className="w-6 h-6 fill-primary text-primary" />
            <span>HealthBuddy</span>
          </div>
          <p className="text-muted-foreground max-w-md">
            Your bilingual AI diet & fitness assistant for smart & healthy living
          </p>
          <div className="flex flex-wrap justify-center gap-6 mt-4">
            <Link to="/" className="hover:text-primary transition-colors">
              Home
            </Link>
            <Link to="/chat" className="hover:text-primary transition-colors">
              AI Coach
            </Link>
            <Link to="/about" className="hover:text-primary transition-colors">
              About
            </Link>
            <Link to="/contact" className="hover:text-primary transition-colors">
              Contact
            </Link>
          </div>
          <div className="mt-6 pt-6 border-t border-border w-full text-center">
            <p className="text-sm text-muted-foreground">
              © 2025 HealthBuddy AI — Made for smart & healthy living 💚
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
