import { Instagram } from "lucide-react";

const InstagramFeed = () => {
  // Instagram feed images - in a real app, these would come from the Instagram API
  const instagramPosts = [
    {
      id: 1,
      image: "https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80",
      link: "#",
    },
    {
      id: 2,
      image: "https://images.unsplash.com/photo-1550614000-4895a10e1bfd?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80",
      link: "#",
    },
    {
      id: 3,
      image: "https://images.unsplash.com/photo-1559664322-f38c9dc4b136?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80",
      link: "#",
    },
    {
      id: 4,
      image: "https://images.unsplash.com/photo-1560243563-062bfc001d68?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80",
      link: "#",
    },
    {
      id: 5,
      image: "https://images.unsplash.com/photo-1608228088998-57828365d486?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80",
      link: "#",
    },
    {
      id: 6,
      image: "https://images.unsplash.com/photo-1581557991964-125469da3b8a?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80",
      link: "#",
    },
  ];

  return (
    <section className="py-16 bg-beige-light">
      <div className="container mx-auto px-4">
        <h2 className="font-playfair text-3xl font-bold text-center mb-4">Follow Us on Instagram</h2>
        <p className="text-center text-gray-600 mb-12">@feminine_elegance</p>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {instagramPosts.map(post => (
            <a 
              key={post.id} 
              href={post.link} 
              target="_blank" 
              rel="noopener noreferrer"
              className="relative group overflow-hidden rounded-lg"
            >
              <img 
                src={post.image} 
                alt="Instagram post" 
                className="w-full h-64 object-cover group-hover:scale-110 transition duration-500"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-purple/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                <div className="text-white flex items-center">
                  <Instagram size={24} />
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
};

export default InstagramFeed;
