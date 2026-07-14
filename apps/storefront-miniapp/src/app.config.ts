export default {
  pages: [
    'pages/products/index',
    'pages/catalog/index',
    'pages/customer-login/index',
    'pages/product-detail/index',
    'pages/cart/index',
    'pages/checkout/index',
    'pages/orders/index',
    'pages/order-detail/index',
    'pages/coupons/index',
    'pages/member/index'
  ],
  window: {
    navigationBarTitleText: '绿膳荟干货海味店',
    navigationBarBackgroundColor: '#ffffff',
    navigationBarTextStyle: 'black',
    backgroundTextStyle: 'light'
  },
  tabBar: {
    color: '#6B7280',
    selectedColor: '#236B45',
    backgroundColor: '#FFFCF4',
    borderStyle: 'white',
    list: [
      {
        pagePath: 'pages/products/index',
        text: '首页',
        iconPath: 'assets/tabbar/home-normal.png',
        selectedIconPath: 'assets/tabbar/home-selected.png'
      },
      {
        pagePath: 'pages/catalog/index',
        text: '商品',
        iconPath: 'assets/tabbar/goods-normal.png',
        selectedIconPath: 'assets/tabbar/goods-selected.png'
      },
      {
        pagePath: 'pages/cart/index',
        text: '购物车',
        iconPath: 'assets/tabbar/cart-normal.png',
        selectedIconPath: 'assets/tabbar/cart-selected.png'
      },
      {
        pagePath: 'pages/orders/index',
        text: '订单',
        iconPath: 'assets/tabbar/orders-normal.png',
        selectedIconPath: 'assets/tabbar/orders-selected.png'
      },
      {
        pagePath: 'pages/customer-login/index',
        text: '我的',
        iconPath: 'assets/tabbar/mine-normal.png',
        selectedIconPath: 'assets/tabbar/mine-selected.png'
      }
    ]
  }
};
