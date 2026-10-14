import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination } from "swiper/modules";

import "swiper/css";
import "swiper/css/pagination";

export default function HeroCarousel() {
  const banners = [
    {
      image: "/banner1.jpeg",
      title: "Ofertas de la Semana",
      subtitle: "Los mejores precios para ti",
    },
    {
      image: "/banner2.jpeg",
      title: "Nuevos Productos",
      subtitle: "Recién llegados",
    },
    {
      image: "/banner3.jpeg",
      title: "Descuentos Exclusivos",
      subtitle: "Solo por tiempo limitado",
    },
  ];

  return (
    <Swiper
      modules={[Autoplay, Pagination]}
      autoplay={{
        delay: 3000,
        disableOnInteraction: false,
      }}
      pagination={{ clickable: true }}
      loop={true}
    >
      {banners.map((banner, index) => (
        <SwiperSlide key={index}>
          <div
            style={{
              backgroundImage: `url(${banner.image})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              height: "500px",
            }}
            className="flex items-center justify-center"
          >
            <div className="bg-black/50 p-8 rounded-xl text-center text-white">
              <h1 className="text-5xl font-bold">{banner.title}</h1>
              <p className="mt-4 text-xl">{banner.subtitle}</p>
            </div>
          </div>
        </SwiperSlide>
      ))}
    </Swiper>
  );
}