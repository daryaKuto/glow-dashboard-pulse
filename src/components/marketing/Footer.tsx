
import { Link } from 'react-router-dom';
import { Mail, Github, Twitter, Linkedin } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-brand-indigo border-t border-brand-lavender/10">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Quick Links */}
          <div>
            <h3 className="text-white font-display text-lg mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/products" className="text-brand-fg-secondary hover:text-brand-lavender">
                  Products
                </Link>
              </li>
              <li>
                <Link to="/signup" className="text-brand-fg-secondary hover:text-brand-lavender">
                  Get Started
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-white font-display text-lg mb-4">Support</h3>
            <a 
              href="mailto:support@funguntraining.com"
              className="text-brand-fg-secondary hover:text-brand-lavender flex items-center gap-2"
            >
              <Mail className="h-4 w-4" />
              support@funguntraining.com
            </a>
          </div>

          {/* Social */}
          <div>
            <h3 className="text-white font-display text-lg mb-4">Connect</h3>
            <div className="flex space-x-4">
              <a href="#" className="text-brand-lavender hover:text-white transition-colors">
                <Twitter className="h-5 w-5" />
              </a>
              <a href="#" className="text-brand-lavender hover:text-white transition-colors">
                <Github className="h-5 w-5" />
              </a>
              <a href="#" className="text-brand-lavender hover:text-white transition-colors">
                <Linkedin className="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-brand-lavender/10 text-center">
          <p className="text-brand-fg-secondary">
            © 2025 Fun Gun Training. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
