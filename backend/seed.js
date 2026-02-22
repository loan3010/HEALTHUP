const mongoose = require('mongoose');
const Product = require('./models/Product');
const Review = require('./models/Review');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/healthup';

const products = [
  {
    images: ['assets/images/products/macadamia.png', 'assets/images/products/macadamia-2.png'],
    name: 'Hạt Macadamia Rang Muối Úc',
    cat: 'Hạt dinh dưỡng',
    rating: 4.9, starsDisplay: '★★★★★', reviewCount: 128, sold: 342,
    price: 185000, oldPrice: 220000, saving: '35.000đ',
    shortDesc: 'Hạt Macadamia nguyên hạt nhập khẩu từ Úc, rang muối vừa phải, giàu axit béo không bão hòa.',
    description: '<p>Hạt Macadamia <strong>Rang Muối Biển</strong> chọn lọc từ Queensland, Úc. Rang nhiệt độ thấp 120°C.</p>',
    stock: 48, badge: 'hot', sale: '-16%',
    weights: [{ label: '250g' }, { label: '500g' }, { label: '1kg', outOfStock: true }],
    packagingTypes: ['Hũ thủy tinh', 'Hũ nhựa', 'Túi zip'],
    weight: '250g / Hũ thủy tinh', stars: '★★★★★', reviews: 128,
    nutrition: [
      { name: 'Năng lượng', value: '718 kcal', percent: 36 },
      { name: 'Chất béo tổng', value: '75.8g', percent: 108 },
      { name: 'Protein', value: '7.9g', percent: 16 },
      { name: 'Carbohydrate', value: '13.8g', percent: 5 },
      { name: 'Chất xơ', value: '8.6g', percent: 34 },
      { name: 'Natri', value: '120mg', percent: 5 }
    ]
  },
  {
    images: ['assets/images/products/granola.png'],
    name: 'Granola Hạnh Nhân Mật Ong',
    cat: 'Granola',
    rating: 4.5, starsDisplay: '★★★★☆', reviewCount: 89, sold: 215,
    price: 145000,
    shortDesc: 'Granola giòn với hạnh nhân, mật ong nguyên chất và yến mạch hữu cơ.',
    description: '<p>Granola làm từ yến mạch hữu cơ, hạnh nhân California và mật ong nguyên chất.</p>',
    stock: 120, badge: 'new',
    weights: [{ label: '400g' }, { label: '800g' }],
    packagingTypes: ['Túi zip', 'Hũ thủy tinh'],
    weight: '400g / Túi zip', stars: '★★★★☆', reviews: 89,
    nutrition: [
      { name: 'Năng lượng', value: '452 kcal', percent: 23 },
      { name: 'Protein', value: '12g', percent: 24 },
      { name: 'Carbohydrate', value: '65g', percent: 25 },
      { name: 'Chất xơ', value: '9g', percent: 36 }
    ]
  },
  {
    images: ['assets/images/products/nho-kho.png'],
    name: 'Nho Khô Không Hạt Nhập Khẩu',
    cat: 'Trái cây sấy',
    rating: 4.9, starsDisplay: '★★★★★', reviewCount: 204, sold: 589,
    price: 98000, oldPrice: 120000,
    shortDesc: 'Nho khô không hạt nhập khẩu, ngọt tự nhiên, không chất bảo quản.',
    description: '<p>Nho khô không hạt chọn lọc, sấy khô tự nhiên giữ nguyên độ ngọt.</p>',
    stock: 200, sale: '-18%',
    weights: [{ label: '300g' }, { label: '500g' }, { label: '1kg' }],
    packagingTypes: ['Hộp giấy', 'Túi zip'],
    weight: '300g / Hộp giấy', stars: '★★★★★', reviews: 204,
    nutrition: [
      { name: 'Năng lượng', value: '299 kcal', percent: 15 },
      { name: 'Carbohydrate', value: '79g', percent: 30 },
      { name: 'Chất xơ', value: '4g', percent: 16 }
    ]
  },
  {
    images: ['assets/images/products/tra.png'],
    name: 'Trà Hoa Cúc Tâm Sen',
    cat: 'Trà thảo mộc',
    rating: 4.5, starsDisplay: '★★★★☆', reviewCount: 56, sold: 134,
    price: 125000,
    shortDesc: 'Trà hoa cúc kết hợp tâm sen giúp thư giãn, dễ ngủ tự nhiên.',
    description: '<p>Trà hoa cúc tâm sen 100% tự nhiên, không chất tạo màu hay hương nhân tạo.</p>',
    stock: 75,
    weights: [{ label: '100g' }, { label: '200g' }],
    packagingTypes: ['Hộp thiếc', 'Túi lọc'],
    weight: '100g / Hộp thiếc', stars: '★★★★☆', reviews: 56,
    nutrition: [
      { name: 'Năng lượng', value: '2 kcal', percent: 0 },
      { name: 'Carbohydrate', value: '0.4g', percent: 0 }
    ]
  },
  {
    images: ['assets/images/products/hat-dieu.png'],
    name: 'Hạt Điều Rang Muối',
    cat: 'Hạt dinh dưỡng',
    rating: 4.9, starsDisplay: '★★★★★', reviewCount: 97, sold: 278,
    price: 155000,
    shortDesc: 'Hạt điều Bình Phước rang muối giòn, thơm ngon, giàu dinh dưỡng.',
    description: '<p>Hạt điều W240 Bình Phước, rang muối biển tự nhiên.</p>',
    stock: 150,
    weights: [{ label: '300g' }, { label: '500g' }, { label: '1kg' }],
    packagingTypes: ['Hũ nhựa', 'Túi zip'],
    weight: '300g / Hũ nhựa', stars: '★★★★★', reviews: 97,
    nutrition: [
      { name: 'Năng lượng', value: '553 kcal', percent: 28 },
      { name: 'Chất béo tổng', value: '43.8g', percent: 63 },
      { name: 'Protein', value: '18.2g', percent: 36 }
    ]
  },
  {
    images: ['assets/images/products/combo1.png'],
    name: 'Combo Eat Clean Cho Người Tập Gym',
    cat: 'Combo',
    rating: 4.9, starsDisplay: '★★★★★', reviewCount: 312, sold: 821,
    price: 390000, oldPrice: 450000, saving: '60.000đ',
    shortDesc: 'Bộ 3 sản phẩm: Macadamia + Granola + Hạt Điều. Tiết kiệm 13%.',
    description: '<p>Combo lý tưởng cho người tập gym và ăn clean.</p>',
    stock: 60, sale: '-13%',
    weights: [{ label: '3 sản phẩm' }],
    packagingTypes: ['Hộp quà'],
    weight: '3 sản phẩm', stars: '★★★★★', reviews: 312,
    nutrition: []
  },
  {
    images: ['assets/images/products/xoai-say.png'],
    name: 'Xoài Sấy Dẻo Không Đường',
    cat: 'Trái cây sấy',
    rating: 4.5, starsDisplay: '★★★★☆', reviewCount: 144, sold: 367,
    price: 75000,
    shortDesc: 'Xoài cát Hòa Lộc sấy dẻo, không đường, vị ngọt tự nhiên.',
    description: '<p>Xoài cát Hòa Lộc tuyển chọn, sấy dẻo bằng công nghệ nhiệt độ thấp.</p>',
    stock: 180, badge: 'new',
    weights: [{ label: '200g' }, { label: '400g' }],
    packagingTypes: ['Túi zip'],
    weight: '200g / Túi zip', stars: '★★★★☆', reviews: 144,
    nutrition: [
      { name: 'Năng lượng', value: '319 kcal', percent: 16 },
      { name: 'Carbohydrate', value: '83g', percent: 32 },
      { name: 'Vitamin C', value: '36mg', percent: 40 }
    ]
  },
  {
    images: ['assets/images/products/granola2.png'],
    name: 'Granola Socola Đen Dừa',
    cat: 'Granola',
    rating: 4.5, starsDisplay: '★★★★☆', reviewCount: 61, sold: 143,
    price: 138000,
    shortDesc: 'Granola socola đen với mảnh dừa giòn và hạt chia, tốt cho tim mạch.',
    description: '<p>Granola socola đen 70% cacao kết hợp dừa nạo và hạt chia.</p>',
    stock: 90,
    weights: [{ label: '300g' }, { label: '600g' }],
    packagingTypes: ['Hũ thủy tinh', 'Túi zip'],
    weight: '300g / Hũ thủy tinh', stars: '★★★★☆', reviews: 61,
    nutrition: [
      { name: 'Năng lượng', value: '475 kcal', percent: 24 },
      { name: 'Protein', value: '10g', percent: 20 }
    ]
  },
  {
    images: ['assets/images/products/hanh-nhan.png'],
    name: 'Hạnh Nhân Nguyên Vỏ California',
    cat: 'Hạt dinh dưỡng',
    rating: 4.9, starsDisplay: '★★★★★', reviewCount: 178, sold: 445,
    price: 210000, oldPrice: 250000, saving: '40.000đ',
    shortDesc: 'Hạnh nhân California nguyên vỏ, rang khô tự nhiên, giàu vitamin E.',
    description: '<p>Hạnh nhân nguyên vỏ nhập khẩu từ California, rang khô không dầu.</p>',
    stock: 85, sale: '-16%',
    weights: [{ label: '500g' }, { label: '1kg' }],
    packagingTypes: ['Túi zip', 'Hũ thủy tinh'],
    weight: '500g / Túi zip', stars: '★★★★★', reviews: 178,
    nutrition: [
      { name: 'Năng lượng', value: '579 kcal', percent: 29 },
      { name: 'Vitamin E', value: '25.6mg', percent: 171 },
      { name: 'Protein', value: '21.2g', percent: 42 }
    ]
  }
];

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    await Product.deleteMany({});
    await Review.deleteMany({});
    
    const createdProducts = await Product.insertMany(products);
    console.log(`✅ ${createdProducts.length} products seeded`);

    // Seed some reviews for first product
    const reviews = [
      {
        productId: createdProducts[0]._id,
        name: 'Ngọc Linh', initial: 'N', avatarColor: '#4A7C2F',
        rating: 5, date: '15/01/2025', variant: '250g · Hũ thủy tinh',
        tags: ['Thơm ngon', 'Đóng gói đẹp', 'Sẽ mua lại'],
        text: 'Macadamia rang muối vừa phải, không bị mặn, hạt chắc và thơm lắm!',
        imgs: [], helpful: 24, verified: true,
        adminReply: 'Cảm ơn bạn Ngọc Linh đã tin tưởng HealthUp!',
        adminReplyDate: '16/01/2025'
      },
      {
        productId: createdProducts[0]._id,
        name: 'Minh Tuấn', initial: 'M', avatarColor: '#3A6FD4',
        rating: 4, date: '10/01/2025', variant: '500g · Hũ nhựa',
        tags: ['Chất lượng tốt', 'Giá hợp lý'],
        text: 'Sản phẩm ngon, giao hàng nhanh. Nhìn chung vẫn ổn, sẽ mua tiếp.',
        imgs: [], helpful: 8, verified: true
      },
      {
        productId: createdProducts[0]._id,
        name: 'Thu Hương', initial: 'T', avatarColor: '#D4854A',
        rating: 5, date: '05/01/2025', variant: '250g · Hũ thủy tinh',
        tags: ['Đóng gói đẹp', 'Đúng như mô tả'],
        text: 'Quà tặng cho mẹ dịp Tết. Đóng gói đẹp lắm, mẹ thích lắm.',
        imgs: [], helpful: 42, verified: true
      }
    ];

    await Review.insertMany(reviews);
    console.log(`✅ ${reviews.length} reviews seeded`);
    
    mongoose.disconnect();
    console.log('🎉 Seeding complete!');
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  }
}

seed();