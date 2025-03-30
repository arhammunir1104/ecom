import { Link } from "wouter";
import { Facebook, Instagram, Twitter, Mail, MapPin, Phone, Clock } from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-purple text-white pt-16 pb-8">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          <div>
            <h3 className="font-playfair text-xl font-bold mb-6">SoftGirlFashion</h3>
            <p className="mb-6 text-gray-300">
              Discover the perfect blend of comfort and cuteness with our curated collection of soft girl fashion essentials for the modern woman.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-white hover:text-pink-light transition">
                <Facebook size={18} />
              </a>
              <a href="#" className="text-white hover:text-pink-light transition">
                <Instagram size={18} />
              </a>
              <a href="#" className="text-white hover:text-pink-light transition">
                <Twitter size={18} />
              </a>
              <a href="#" className="text-white hover:text-pink-light transition">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 448 512">
                  <path d="M448,209.91a210.06,210.06,0,0,1-122.77-39.25V349.38A162.55,162.55,0,1,1,185,188.31V278.2a74.62,74.62,0,1,0,52.23,71.18V0l88,0a121.18,121.18,0,0,0,1.86,22.17h0A122.18,122.18,0,0,0,448,209.91Z" />
                </svg>
              </a>
            </div>
          </div>
          
          <div>
            <h4 className="font-medium text-lg mb-6">Shop</h4>
            <ul className="space-y-3">
              <li>
                <Link href="/shop?new=true" className="text-gray-300 hover:text-pink-light transition">
                  New Arrivals
                </Link>
              </li>
              <li>
                <Link href="/shop?bestseller=true" className="text-gray-300 hover:text-pink-light transition">
                  Best Sellers
                </Link>
              </li>
              <li>
                <Link href="/shop?sale=true" className="text-gray-300 hover:text-pink-light transition">
                  Sale
                </Link>
              </li>
              <li>
                <Link href="/categories" className="text-gray-300 hover:text-pink-light transition">
                  Collections
                </Link>
              </li>
              <li>
                <a href="#" className="text-gray-300 hover:text-pink-light transition">
                  Gift Cards
                </a>
              </li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-medium text-lg mb-6">Information</h4>
            <ul className="space-y-3">
              <li>
                <a href="#" className="text-gray-300 hover:text-pink-light transition">
                  About Us
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-300 hover:text-pink-light transition">
                  Contact Us
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-300 hover:text-pink-light transition">
                  Shipping & Returns
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-300 hover:text-pink-light transition">
                  Size Guide
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-300 hover:text-pink-light transition">
                  FAQ
                </a>
              </li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-medium text-lg mb-6">Contact</h4>
            <ul className="space-y-3">
              <li className="flex items-start">
                <MapPin className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" />
                <span className="text-gray-300">1234 Fashion Avenue, New York, NY 10001</span>
              </li>
              <li className="flex items-center">
                <Phone className="w-5 h-5 mr-3 flex-shrink-0" />
                <span className="text-gray-300">+1 (800) 555-1234</span>
              </li>
              <li className="flex items-center">
                <Mail className="w-5 h-5 mr-3 flex-shrink-0" />
                <span className="text-gray-300">support@softgirlfashion.com</span>
              </li>
              <li className="flex items-center">
                <Clock className="w-5 h-5 mr-3 flex-shrink-0" />
                <span className="text-gray-300">Mon-Fri: 9am - 6pm</span>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-purple-light pt-8">
          <div className="flex flex-col md:flex-row md:justify-between items-center">
            <p className="text-gray-300 mb-4 md:mb-0">
              &copy; {new Date().getFullYear()} SoftGirlFashion. All rights reserved.
            </p>
            <div className="flex flex-wrap justify-center space-x-4">
              <a href="#" className="text-gray-300 hover:text-pink-light transition">
                Privacy Policy
              </a>
              <a href="#" className="text-gray-300 hover:text-pink-light transition">
                Terms of Service
              </a>
              <a href="#" className="text-gray-300 hover:text-pink-light transition">
                Accessibility
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
