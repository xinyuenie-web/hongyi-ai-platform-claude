export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/trees/index',
    'pages/tree-detail/index',
    'pages/styles/index',
    'pages/appointment/index',
    'pages/quotation/index',
    'pages/care/index',
    'pages/contact/index',
    'pages/mine/index',
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#1F3864',
    navigationBarTitleText: '红艺花木',
    navigationBarTextStyle: 'white',
  },
  tabBar: {
    color: '#999999',
    selectedColor: '#1F3864',
    backgroundColor: '#ffffff',
    borderStyle: 'black',
    list: [
      {
        pagePath: 'pages/index/index',
        text: '首页',
        iconPath: 'assets/tab-home.png',
        selectedIconPath: 'assets/tab-home-active.png',
      },
      {
        pagePath: 'pages/trees/index',
        text: '精品树木',
        iconPath: 'assets/tab-tree.png',
        selectedIconPath: 'assets/tab-tree-active.png',
      },
      {
        pagePath: 'pages/styles/index',
        text: '庭院风格',
        iconPath: 'assets/tab-style.png',
        selectedIconPath: 'assets/tab-style-active.png',
      },
      {
        pagePath: 'pages/mine/index',
        text: '我的',
        iconPath: 'assets/tab-mine.png',
        selectedIconPath: 'assets/tab-mine-active.png',
      },
    ],
  },
});
