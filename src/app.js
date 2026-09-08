/**
 * Outmap 3D GIS - 核心引擎
 * 默认风格：Outmap 自然绿白地势 + 亚米级高清卫星影像 + 全量微观路网/建筑/山峰/POI
 * 整合 Office 365 紧凑一体化顶栏、视角倾角锁定与金字塔多级离线下载系统
 */

// 1. 全国 34 省级行政区中心、地理外包围盒 (用于精确金字塔切片计算) 与三维视点
// 1. 全国 34 省级行政区中心、地理外包围盒 (按首字母拼音 A-Z 严格排序，含港澳台)
const PROVINCES_DATA = {
  china: { name: '全国总览', en: 'ALL CHINA 3D', pinyin: 'Quanguo', py: 'qg', pinyinGroup: 'Top', center: [104.5, 36.0], zoom: 4.45, pitch: 50, bbox: [73.5, 135.1, 18.0, 53.6] },
  anhui: { name: '安徽省', en: 'Anhui', pinyin: 'Anhui', py: 'ah', pinyinGroup: 'A', center: [117.2, 31.8], zoom: 7.2, pitch: 60, bbox: [114.8, 119.6, 29.7, 34.6] },
  aomen: { name: '澳门特别行政区', en: 'Macao', pinyin: 'Aomen', py: 'am', pinyinGroup: 'A', center: [113.5439, 22.1987], zoom: 11.5, pitch: 55, bbox: [113.52, 113.60, 22.10, 22.22] },
  beijing: { name: '北京市', en: 'Beijing', pinyin: 'Beijing', py: 'bj', pinyinGroup: 'B', center: [116.4, 39.9], zoom: 9.2, pitch: 62, bbox: [115.4, 117.5, 39.4, 41.1] },
  chongqing: { name: '重庆市', en: 'Chongqing', pinyin: 'Chongqing', py: 'cq', pinyinGroup: 'C', center: [106.5, 29.5], zoom: 8.0, pitch: 62, bbox: [105.3, 110.2, 28.2, 32.2] },
  fujian: { name: '福建省', en: 'Fujian', pinyin: 'Fujian', py: 'fj', pinyinGroup: 'F', center: [118.0, 26.0], zoom: 7.2, pitch: 60, bbox: [115.8, 120.7, 23.5, 28.3] },
  gansu: { name: '甘肃省', en: 'Gansu', pinyin: 'Gansu', py: 'gs', pinyinGroup: 'G', center: [100.0, 38.0], zoom: 6.2, pitch: 60, bbox: [92.2, 108.7, 32.5, 42.8] },
  guangdong: { name: '广东省', en: 'Guangdong', pinyin: 'Guangdong', py: 'gd', pinyinGroup: 'G', center: [113.3, 23.1], zoom: 7.2, pitch: 55, bbox: [109.6, 117.3, 20.2, 25.5] },
  guangxi: { name: '广西壮族自治区', en: 'Guangxi', pinyin: 'Guangxi', py: 'gx', pinyinGroup: 'G', center: [108.5, 23.8], zoom: 7.0, pitch: 60, bbox: [104.4, 112.1, 20.9, 26.4] },
  guizhou: { name: '贵州省', en: 'Guizhou', pinyin: 'Guizhou', py: 'gz', pinyinGroup: 'G', center: [106.7, 26.8], zoom: 7.2, pitch: 62, bbox: [103.6, 109.6, 24.6, 29.2] },
  hainan: { name: '海南省', en: 'Hainan', pinyin: 'Hainan', py: 'hn', pinyinGroup: 'H', center: [109.8, 19.2], zoom: 8.0, pitch: 58, bbox: [108.6, 111.1, 18.1, 20.2] },
  hebei: { name: '河北省', en: 'Hebei', pinyin: 'Hebei', py: 'hb', pinyinGroup: 'H', center: [115.0, 38.0], zoom: 7.0, pitch: 58, bbox: [113.4, 119.8, 36.0, 42.6] },
  heilongjiang: { name: '黑龙江省', en: 'Heilongjiang', pinyin: 'Heilongjiang', py: 'hlj', pinyinGroup: 'H', center: [127.0, 47.0], zoom: 6.0, pitch: 55, bbox: [121.2, 135.1, 43.4, 53.6] },
  henan: { name: '河南省', en: 'Henan', pinyin: 'Henan', py: 'hn', pinyinGroup: 'H', center: [113.6, 34.0], zoom: 7.2, pitch: 58, bbox: [110.3, 116.6, 31.4, 36.4] },
  hubei: { name: '湖北省', en: 'Hubei', pinyin: 'Hubei', py: 'hb', pinyinGroup: 'H', center: [112.5, 31.0], zoom: 7.2, pitch: 60, bbox: [108.3, 116.1, 29.0, 33.3] },
  hunan: { name: '湖南省', en: 'Hunan', pinyin: 'Hunan', py: 'hn', pinyinGroup: 'H', center: [112.0, 27.5], zoom: 7.2, pitch: 60, bbox: [108.8, 114.2, 24.6, 30.1] },
  jilin: { name: '吉林省', en: 'Jilin', pinyin: 'Jilin', py: 'jl', pinyinGroup: 'J', center: [126.0, 43.5], zoom: 6.8, pitch: 58, bbox: [121.6, 131.3, 40.8, 46.3] },
  jiangsu: { name: '江苏省', en: 'Jiangsu', pinyin: 'Jiangsu', py: 'js', pinyinGroup: 'J', center: [119.8, 33.0], zoom: 7.2, pitch: 50, bbox: [116.3, 121.9, 30.7, 35.1] },
  jiangxi: { name: '江西省', en: 'Jiangxi', pinyin: 'Jiangxi', py: 'jx', pinyinGroup: 'J', center: [115.8, 27.8], zoom: 7.2, pitch: 60, bbox: [113.5, 118.5, 24.5, 30.1] },
  liaoning: { name: '辽宁省', en: 'Liaoning', pinyin: 'Liaoning', py: 'ln', pinyinGroup: 'L', center: [123.0, 41.5], zoom: 7.2, pitch: 58, bbox: [118.8, 125.8, 38.7, 43.5] },
  neimenggu: { name: '内蒙古自治区', en: 'Inner Mongolia', pinyin: 'Neimenggu', py: 'nmg', pinyinGroup: 'N', center: [112.0, 44.0], zoom: 5.5, pitch: 55, bbox: [97.2, 126.1, 37.4, 53.4] },
  ningxia: { name: '宁夏回族自治区', en: 'Ningxia', pinyin: 'Ningxia', py: 'nx', pinyinGroup: 'N', center: [106.2, 37.2], zoom: 7.5, pitch: 60, bbox: [104.3, 107.7, 35.2, 39.4] },
  qinghai: { name: '青海省', en: 'Qinghai', pinyin: 'Qinghai', py: 'qh', pinyinGroup: 'Q', center: [96.0, 35.5], zoom: 6.2, pitch: 58, bbox: [89.4, 103.1, 31.6, 39.3] },
  shandong: { name: '山东省', en: 'Shandong', pinyin: 'Shandong', py: 'sd', pinyinGroup: 'S', center: [117.5, 36.4], zoom: 7.6, pitch: 60, bbox: [114.8, 122.7, 34.3, 38.4] },
  shanxi: { name: '山西省', en: 'Shanxi', pinyin: 'Shanxi', py: 'sx', pinyinGroup: 'S', center: [112.5, 37.8], zoom: 7.0, pitch: 60, bbox: [110.2, 114.5, 34.6, 40.7] },
  shaanxi: { name: '陕西省', en: 'Shaanxi', pinyin: 'Shaanxi', py: 'sx', pinyinGroup: 'S', center: [108.9, 34.3], zoom: 7.2, pitch: 60, bbox: [105.5, 111.2, 31.7, 39.6] },
  shanghai: { name: '上海市', en: 'Shanghai', pinyin: 'Shanghai', py: 'sh', pinyinGroup: 'S', center: [121.5, 31.2], zoom: 10.0, pitch: 50, bbox: [120.8, 122.2, 30.7, 31.9] },
  sichuan: { name: '四川省', en: 'Sichuan', pinyin: 'Sichuan', py: 'sc', pinyinGroup: 'S', center: [102.8, 30.5], zoom: 7.2, pitch: 62, bbox: [97.3, 108.5, 26.0, 34.3] },
  taiwan: { name: '台湾省', en: 'Taiwan', pinyin: 'Taiwan', py: 'tw', pinyinGroup: 'T', center: [121.0, 23.8], zoom: 8.0, pitch: 65, bbox: [119.9, 122.1, 21.8, 25.4] },
  tianjin: { name: '天津市', en: 'Tianjin', pinyin: 'Tianjin', py: 'tj', pinyinGroup: 'T', center: [117.2, 39.1], zoom: 9.5, pitch: 50, bbox: [116.7, 118.1, 38.5, 40.3] },
  xizang: { name: '西藏自治区', en: 'Tibet', pinyin: 'Xizang', py: 'xz', pinyinGroup: 'X', center: [88.5, 31.0], zoom: 6.0, pitch: 60, bbox: [78.4, 99.1, 26.8, 36.5] },
  xianggang: { name: '香港特别行政区', en: 'Hong Kong', pinyin: 'Xianggang', py: 'xg', pinyinGroup: 'X', center: [114.1654, 22.2753], zoom: 11.0, pitch: 55, bbox: [113.83, 114.44, 22.15, 22.56] },
  xinjiang: { name: '新疆维吾尔自治区', en: 'Xinjiang', pinyin: 'Xinjiang', py: 'xj', pinyinGroup: 'X', center: [85.0, 41.5], zoom: 5.8, pitch: 58, bbox: [73.5, 96.4, 34.3, 49.2] },
  yunnan: { name: '云南省', en: 'Yunnan', pinyin: 'Yunnan', py: 'yn', pinyinGroup: 'Y', center: [101.5, 25.0], zoom: 7.0, pitch: 62, bbox: [97.5, 106.2, 21.1, 29.2] },
  zhejiang: { name: '浙江省', en: 'Zhejiang', pinyin: 'Zhejiang', py: 'zj', pinyinGroup: 'Z', center: [120.2, 29.2], zoom: 7.5, pitch: 60, bbox: [118.0, 123.0, 27.0, 31.3] }
};

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[m]));
}

// 2. 重点地标城市与著名乡镇
const MAJOR_CITIES = [
  { name: "北京市", pinyin: "beijing", py: "bj", coords: [116.4074, 39.9042], province: "北京市" },
  { name: "上海市", pinyin: "shanghai", py: "sh", coords: [121.4737, 31.2304], province: "上海市" },
  { name: "天津市", pinyin: "tianjin", py: "tj", coords: [117.2008, 39.0842], province: "天津市" },
  { name: "重庆市", pinyin: "chongqing", py: "cq", coords: [106.5516, 29.563], province: "重庆市" },
  { name: "济南市", pinyin: "jinan", py: "jn", coords: [117.0009, 36.6758], province: "山东省" },
  { name: "青岛市", pinyin: "qingdao", py: "qd", coords: [120.3826, 36.0671], province: "山东省" },
  { name: "淄博市", pinyin: "zibo", py: "zb", coords: [118.0476, 36.8149], province: "山东省" },
  { name: "枣庄市", pinyin: "zaozhuang", py: "zz", coords: [117.5579, 34.8564], province: "山东省" },
  { name: "东营市", pinyin: "dongying", py: "dy", coords: [118.6647, 37.4346], province: "山东省" },
  { name: "烟台市", pinyin: "yantai", py: "yt", coords: [121.3914, 37.5388], province: "山东省" },
  { name: "潍坊市", pinyin: "weifang", py: "wf", coords: [119.1071, 36.7093], province: "山东省" },
  { name: "济宁市", pinyin: "jining", py: "jn", coords: [116.5872, 35.4154], province: "山东省" },
  { name: "泰安市", pinyin: "taian", py: "ta", coords: [117.129, 36.1949], province: "山东省" },
  { name: "威海市", pinyin: "weihai", py: "wh", coords: [122.1164, 37.5097], province: "山东省" },
  { name: "日照市", pinyin: "rizhao", py: "rz", coords: [119.4612, 35.4286], province: "山东省" },
  { name: "临沂市", pinyin: "linyi", py: "ly", coords: [118.3564, 35.1047], province: "山东省" },
  { name: "德州市", pinyin: "dezhou", py: "dz", coords: [116.3075, 37.454], province: "山东省" },
  { name: "聊城市", pinyin: "liaocheng", py: "lc", coords: [115.9804, 36.456], province: "山东省" },
  { name: "滨州市", pinyin: "binzhou", py: "bz", coords: [118.017, 37.3835], province: "山东省" },
  { name: "菏泽市", pinyin: "heze", py: "hz", coords: [115.4694, 35.2465], province: "山东省" },
  { name: "曲阜市", pinyin: "qufu", py: "qf", coords: [116.9865, 35.5807], province: "山东省" },
  { name: "石家庄市", pinyin: "shijiazhuang", py: "sjz", coords: [114.5149, 38.0423], province: "河北省" },
  { name: "唐山市", pinyin: "tangshan", py: "ts", coords: [118.1754, 39.6352], province: "河北省" },
  { name: "秦皇岛市", pinyin: "qinhuangdao", py: "qhd", coords: [119.5866, 39.9425], province: "河北省" },
  { name: "邯郸市", pinyin: "handan", py: "hd", coords: [114.4907, 36.6123], province: "河北省" },
  { name: "邢台市", pinyin: "xingtai", py: "xt", coords: [114.5089, 37.0682], province: "河北省" },
  { name: "保定市", pinyin: "baoding", py: "bd", coords: [115.4824, 38.8677], province: "河北省" },
  { name: "张家口市", pinyin: "zhangjiakou", py: "zjk", coords: [114.8841, 40.8119], province: "河北省" },
  { name: "承德市", pinyin: "chengde", py: "cd", coords: [117.9392, 40.9762], province: "河北省" },
  { name: "沧州市", pinyin: "cangzhou", py: "cz", coords: [116.8575, 38.3106], province: "河北省" },
  { name: "廊坊市", pinyin: "langfang", py: "lf", coords: [116.7044, 39.5239], province: "河北省" },
  { name: "衡水市", pinyin: "hengshui", py: "hs", coords: [115.6659, 37.7351], province: "河北省" },
  { name: "雄安新区", pinyin: "xiongan", py: "xa", coords: [115.9856, 38.9944], province: "河北省" },
  { name: "太原市", pinyin: "taiyuan", py: "ty", coords: [112.5492, 37.857], province: "山西省" },
  { name: "大同市", pinyin: "datong", py: "dt", coords: [113.2953, 40.0903], province: "山西省" },
  { name: "阳泉市", pinyin: "yangquan", py: "yq", coords: [113.5833, 37.8611], province: "山西省" },
  { name: "长治市", pinyin: "changzhi", py: "cz", coords: [113.1136, 36.1911], province: "山西省" },
  { name: "晋城市", pinyin: "jincheng", py: "jc", coords: [112.8513, 35.4976], province: "山西省" },
  { name: "朔州市", pinyin: "shuozhou", py: "sz", coords: [112.4334, 39.3313], province: "山西省" },
  { name: "晋中市", pinyin: "jinzhong", py: "jz", coords: [112.7365, 37.6965], province: "山西省" },
  { name: "运城市", pinyin: "yuncheng", py: "yc", coords: [111.004, 35.0264], province: "山西省" },
  { name: "忻州市", pinyin: "xinzhou", py: "xz", coords: [112.7335, 38.4177], province: "山西省" },
  { name: "临汾市", pinyin: "linfen", py: "lf", coords: [111.5179, 36.0841], province: "山西省" },
  { name: "吕梁市", pinyin: "lvliang", py: "ll", coords: [111.1343, 37.5244], province: "山西省" },
  { name: "平遥古城", pinyin: "pingyao", py: "py", coords: [112.1887, 37.2023], province: "山西省" },
  { name: "南京市", pinyin: "nanjing", py: "nj", coords: [118.7969, 32.0603], province: "江苏省" },
  { name: "无锡市", pinyin: "wuxi", py: "wx", coords: [120.3017, 31.5747], province: "江苏省" },
  { name: "徐州市", pinyin: "xuzhou", py: "xz", coords: [117.1848, 34.2618], province: "江苏省" },
  { name: "常州市", pinyin: "changzhou", py: "cz", coords: [119.9469, 31.7728], province: "江苏省" },
  { name: "苏州市", pinyin: "suzhou", py: "sz", coords: [120.6195, 31.2994], province: "江苏省" },
  { name: "南通市", pinyin: "nantong", py: "nt", coords: [120.8943, 31.9802], province: "江苏省" },
  { name: "连云港市", pinyin: "lianyungang", py: "lyg", coords: [119.1788, 34.6], province: "江苏省" },
  { name: "淮安市", pinyin: "huaian", py: "ha", coords: [119.0213, 33.5975], province: "江苏省" },
  { name: "盐城市", pinyin: "yancheng", py: "yc", coords: [120.1399, 33.3776], province: "江苏省" },
  { name: "扬州市", pinyin: "yangzhou", py: "yz", coords: [119.421, 32.3932], province: "江苏省" },
  { name: "镇江市", pinyin: "zhenjiang", py: "zj", coords: [119.4528, 32.2044], province: "江苏省" },
  { name: "泰州市", pinyin: "taizhou", py: "tz", coords: [119.9152, 32.4849], province: "江苏省" },
  { name: "宿迁市", pinyin: "suqian", py: "sq", coords: [118.2752, 33.963], province: "江苏省" },
  { name: "杭州市", pinyin: "hangzhou", py: "hz", coords: [120.1536, 30.2875], province: "浙江省" },
  { name: "宁波市", pinyin: "ningbo", py: "nb", coords: [121.5498, 29.8684], province: "浙江省" },
  { name: "温州市", pinyin: "wenzhou", py: "wz", coords: [120.6721, 28.0006], province: "浙江省" },
  { name: "嘉兴市", pinyin: "jiaxing", py: "jx", coords: [120.7509, 30.7627], province: "浙江省" },
  { name: "湖州市", pinyin: "huzhou", py: "hz", coords: [120.1024, 30.8672], province: "浙江省" },
  { name: "绍兴市", pinyin: "shaoxing", py: "sx", coords: [120.5821, 30.0024], province: "浙江省" },
  { name: "金华市", pinyin: "jinhua", py: "jh", coords: [119.6495, 29.0895], province: "浙江省" },
  { name: "衢州市", pinyin: "quzhou", py: "qz", coords: [118.8726, 28.9417], province: "浙江省" },
  { name: "舟山市", pinyin: "zhoushan", py: "zs", coords: [122.1069, 29.9978], province: "浙江省" },
  { name: "台州市", pinyin: "taizhou", py: "tz", coords: [121.4286, 28.6614], province: "浙江省" },
  { name: "丽水市", pinyin: "lishui", py: "ls", coords: [119.9218, 28.452], province: "浙江省" },
  { name: "义乌市", pinyin: "yiwu", py: "yw", coords: [120.0745, 29.3056], province: "浙江省" },
  { name: "合肥市", pinyin: "hefei", py: "hf", coords: [117.283, 31.8612], province: "安徽省" },
  { name: "芜湖市", pinyin: "wuhu", py: "wh", coords: [118.3765, 31.3263], province: "安徽省" },
  { name: "蚌埠市", pinyin: "bengbu", py: "bb", coords: [117.3632, 32.9397], province: "安徽省" },
  { name: "淮南市", pinyin: "huainan", py: "hn", coords: [116.9999, 32.6255], province: "安徽省" },
  { name: "马鞍山市", pinyin: "maanshan", py: "mas", coords: [118.5079, 31.6894], province: "安徽省" },
  { name: "淮北市", pinyin: "huaibei", py: "hb", coords: [116.7946, 33.9717], province: "安徽省" },
  { name: "铜陵市", pinyin: "tongling", py: "tl", coords: [117.8166, 30.9299], province: "安徽省" },
  { name: "安庆市", pinyin: "anqing", py: "aq", coords: [117.0536, 30.5288], province: "安徽省" },
  { name: "黄山市", pinyin: "huangshan", py: "hs", coords: [118.3173, 29.7092], province: "安徽省" },
  { name: "滁州市", pinyin: "chuzhou", py: "cz", coords: [118.3162, 32.3036], province: "安徽省" },
  { name: "阜阳市", pinyin: "fuyang", py: "fy", coords: [115.8197, 32.897], province: "安徽省" },
  { name: "宿州市", pinyin: "suzhou", py: "sz", coords: [116.9841, 33.6339], province: "安徽省" },
  { name: "六安市", pinyin: "liuan", py: "la", coords: [116.5077, 31.7529], province: "安徽省" },
  { name: "亳州市", pinyin: "bozhou", py: "bz", coords: [115.7829, 33.8693], province: "安徽省" },
  { name: "池州市", pinyin: "chizhou", py: "cz", coords: [117.4892, 30.656], province: "安徽省" },
  { name: "宣城市", pinyin: "xuancheng", py: "xc", coords: [118.7579, 30.9457], province: "安徽省" },
  { name: "福州市", pinyin: "fuzhou", py: "fz", coords: [119.3062, 26.0753], province: "福建省" },
  { name: "厦门市", pinyin: "xiamen", py: "xm", coords: [118.1102, 24.4905], province: "福建省" },
  { name: "莆田市", pinyin: "putian", py: "pt", coords: [119.0076, 25.431], province: "福建省" },
  { name: "三明市", pinyin: "sanming", py: "sm", coords: [117.635, 26.2654], province: "福建省" },
  { name: "泉州市", pinyin: "quanzhou", py: "qz", coords: [118.5894, 24.9089], province: "福建省" },
  { name: "漳州市", pinyin: "zhangzhou", py: "zz", coords: [117.6618, 24.5109], province: "福建省" },
  { name: "南平市", pinyin: "nanping", py: "np", coords: [118.1785, 26.642], province: "福建省" },
  { name: "龙岩市", pinyin: "longyan", py: "ly", coords: [117.0298, 25.0916], province: "福建省" },
  { name: "宁德市", pinyin: "ningde", py: "nd", coords: [119.5271, 26.6592], province: "福建省" },
  { name: "武夷山市", pinyin: "wuyishan", py: "wys", coords: [118.0315, 27.7554], province: "福建省" },
  { name: "南昌市", pinyin: "nanchang", py: "nc", coords: [115.8921, 28.6765], province: "江西省" },
  { name: "景德镇市", pinyin: "jingdezhen", py: "jdz", coords: [117.2147, 29.2926], province: "江西省" },
  { name: "萍乡市", pinyin: "pingxiang", py: "px", coords: [113.8546, 27.6229], province: "江西省" },
  { name: "九江市", pinyin: "jiujiang", py: "jj", coords: [115.9928, 29.712], province: "江西省" },
  { name: "新余市", pinyin: "xinyu", py: "xy", coords: [114.9308, 27.8108], province: "江西省" },
  { name: "鹰潭市", pinyin: "yingtan", py: "yt", coords: [117.0338, 28.2386], province: "江西省" },
  { name: "赣州市", pinyin: "ganzhou", py: "gz", coords: [114.9403, 25.851], province: "江西省" },
  { name: "吉安市", pinyin: "jian", py: "ja", coords: [114.9864, 27.1117], province: "江西省" },
  { name: "宜春市", pinyin: "yichun", py: "yc", coords: [114.3911, 27.8043], province: "江西省" },
  { name: "抚州市", pinyin: "fuzhou", py: "fz", coords: [116.3584, 27.9839], province: "江西省" },
  { name: "上饶市", pinyin: "shangrao", py: "sr", coords: [117.9712, 28.4444], province: "江西省" },
  { name: "婺源县", pinyin: "wuyuan", py: "wy", coords: [117.8611, 29.2483], province: "江西省" },
  { name: "郑州市", pinyin: "zhengzhou", py: "zz", coords: [113.6654, 34.758], province: "河南省" },
  { name: "开封市", pinyin: "kaifeng", py: "kf", coords: [114.3414, 34.797], province: "河南省" },
  { name: "洛阳市", pinyin: "luoyang", py: "ly", coords: [112.4345, 34.663], province: "河南省" },
  { name: "平顶山市", pinyin: "pingdingshan", py: "pds", coords: [113.3077, 33.7352], province: "河南省" },
  { name: "安阳市", pinyin: "anyang", py: "ay", coords: [114.3525, 36.1034], province: "河南省" },
  { name: "鹤壁市", pinyin: "hebi", py: "hb", coords: [114.2954, 35.7482], province: "河南省" },
  { name: "新乡市", pinyin: "xinxiang", py: "xx", coords: [113.8839, 35.3026], province: "河南省" },
  { name: "焦作市", pinyin: "jiaozuo", py: "jz", coords: [113.2383, 35.239], province: "河南省" },
  { name: "濮阳市", pinyin: "puyang", py: "py", coords: [115.0413, 35.7682], province: "河南省" },
  { name: "许昌市", pinyin: "xuchang", py: "xc", coords: [113.8261, 34.023], province: "河南省" },
  { name: "漯河市", pinyin: "luohe", py: "lh", coords: [114.0264, 33.5759], province: "河南省" },
  { name: "三门峡市", pinyin: "sanmenxia", py: "smx", coords: [111.1944, 34.7773], province: "河南省" },
  { name: "南阳市", pinyin: "nanyang", py: "ny", coords: [112.5409, 32.9908], province: "河南省" },
  { name: "商丘市", pinyin: "shangqiu", py: "sq", coords: [115.6554, 34.4192], province: "河南省" },
  { name: "信阳市", pinyin: "xinyang", py: "xy", coords: [114.075, 32.1233], province: "河南省" },
  { name: "周口市", pinyin: "zhoukou", py: "zk", coords: [114.6497, 33.6204], province: "河南省" },
  { name: "驻马店市", pinyin: "zhumadian", py: "zmd", coords: [114.0247, 32.9802], province: "河南省" },
  { name: "武汉市", pinyin: "wuhan", py: "wh", coords: [114.3055, 30.5928], province: "湖北省" },
  { name: "黄石市", pinyin: "huangshi", py: "hs", coords: [115.077, 30.2201], province: "湖北省" },
  { name: "十堰市", pinyin: "shiyan", py: "sy", coords: [110.7879, 32.6469], province: "湖北省" },
  { name: "宜昌市", pinyin: "yichang", py: "yc", coords: [111.2908, 30.7026], province: "湖北省" },
  { name: "襄阳市", pinyin: "xiangyang", py: "xy", coords: [112.1441, 32.0424], province: "湖北省" },
  { name: "鄂州市", pinyin: "ezhou", py: "ez", coords: [114.8906, 30.3965], province: "湖北省" },
  { name: "荆门市", pinyin: "jingmen", py: "jm", coords: [112.2043, 31.0354], province: "湖北省" },
  { name: "孝感市", pinyin: "xiaogan", py: "xg", coords: [113.9267, 30.9264], province: "湖北省" },
  { name: "荆州市", pinyin: "jingzhou", py: "jz", coords: [112.2381, 30.3268], province: "湖北省" },
  { name: "黄冈市", pinyin: "huanggang", py: "hg", coords: [114.8794, 30.4477], province: "湖北省" },
  { name: "咸宁市", pinyin: "xianning", py: "xn", coords: [114.3288, 29.8328], province: "湖北省" },
  { name: "随州市", pinyin: "suizhou", py: "sz", coords: [113.3738, 31.7179], province: "湖北省" },
  { name: "恩施土家族苗族自治州", pinyin: "enshi", py: "es", coords: [109.4869, 30.2831], province: "湖北省" },
  { name: "神农架林区", pinyin: "shennongjia", py: "snj", coords: [110.6715, 31.7444], province: "湖北省" },
  { name: "长沙市", pinyin: "changsha", py: "cs", coords: [112.9388, 28.2282], province: "湖南省" },
  { name: "株洲市", pinyin: "zhuzhou", py: "zz", coords: [113.1517, 27.8358], province: "湖南省" },
  { name: "湘潭市", pinyin: "xiangtan", py: "xt", coords: [112.9441, 27.8297], province: "湖南省" },
  { name: "衡阳市", pinyin: "hengyang", py: "hy", coords: [112.6077, 26.9004], province: "湖南省" },
  { name: "邵阳市", pinyin: "shaoyang", py: "sy", coords: [111.4692, 27.2378], province: "湖南省" },
  { name: "岳阳市", pinyin: "yueyang", py: "yy", coords: [113.1329, 29.3703], province: "湖南省" },
  { name: "常德市", pinyin: "changde", py: "cd", coords: [111.6913, 29.0402], province: "湖南省" },
  { name: "张家界市", pinyin: "zhangjiajie", py: "zjj", coords: [110.4799, 29.1274], province: "湖南省" },
  { name: "益阳市", pinyin: "yiyang", py: "yy", coords: [112.355, 28.5701], province: "湖南省" },
  { name: "郴州市", pinyin: "chenzhou", py: "cz", coords: [113.032, 25.7936], province: "湖南省" },
  { name: "永州市", pinyin: "yongzhou", py: "yz", coords: [111.608, 26.4345], province: "湖南省" },
  { name: "怀化市", pinyin: "huaihua", py: "hh", coords: [109.9782, 27.5501], province: "湖南省" },
  { name: "娄底市", pinyin: "loudi", py: "ld", coords: [111.994, 27.7281], province: "湖南省" },
  { name: "湘西土家族苗族自治州", pinyin: "xiangxi", py: "xx", coords: [109.7397, 28.312], province: "湖南省" },
  { name: "凤凰古城", pinyin: "fenghuang", py: "fh", coords: [109.6015, 27.9542], province: "湖南省" },
  { name: "广州市", pinyin: "guangzhou", py: "gz", coords: [113.2644, 23.1291], province: "广东省" },
  { name: "深圳市", pinyin: "shenzhen", py: "sz", coords: [114.0579, 22.5431], province: "广东省" },
  { name: "珠海市", pinyin: "zhuhai", py: "zh", coords: [113.5767, 22.2707], province: "广东省" },
  { name: "汕头市", pinyin: "shantou", py: "st", coords: [116.6819, 23.3541], province: "广东省" },
  { name: "佛山市", pinyin: "foshan", py: "fs", coords: [113.122, 23.0288], province: "广东省" },
  { name: "江门市", pinyin: "jiangmen", py: "jm", coords: [113.0815, 22.5787], province: "广东省" },
  { name: "湛江市", pinyin: "zhanjiang", py: "zj", coords: [110.3649, 21.2749], province: "广东省" },
  { name: "茂名市", pinyin: "maoming", py: "mm", coords: [110.9192, 21.6598], province: "广东省" },
  { name: "肇庆市", pinyin: "zhaoqing", py: "zq", coords: [112.4725, 23.0515], province: "广东省" },
  { name: "惠州市", pinyin: "huizhou", py: "hz", coords: [114.4172, 23.097], province: "广东省" },
  { name: "梅州市", pinyin: "meizhou", py: "mz", coords: [116.1176, 24.2991], province: "广东省" },
  { name: "汕尾市", pinyin: "shanwei", py: "sw", coords: [115.3642, 22.7745], province: "广东省" },
  { name: "河源市", pinyin: "heyuan", py: "hy", coords: [114.6978, 23.7463], province: "广东省" },
  { name: "阳江市", pinyin: "yangjiang", py: "yj", coords: [111.9751, 21.8566], province: "广东省" },
  { name: "清远市", pinyin: "qingyuan", py: "qy", coords: [113.0512, 23.685], province: "广东省" },
  { name: "东莞市", pinyin: "dongguan", py: "dg", coords: [113.7518, 23.0207], province: "广东省" },
  { name: "中山市", pinyin: "zhongshan", py: "zs", coords: [113.3824, 22.5211], province: "广东省" },
  { name: "潮州市", pinyin: "chaozhou", py: "cz", coords: [116.6323, 23.6617], province: "广东省" },
  { name: "揭阳市", pinyin: "jieyang", py: "jy", coords: [116.3557, 23.5438], province: "广东省" },
  { name: "云浮市", pinyin: "yunfu", py: "yf", coords: [112.0444, 22.9298], province: "广东省" },
  { name: "成都市", pinyin: "chengdu", py: "cd", coords: [104.0668, 30.5728], province: "四川省" },
  { name: "绵阳市", pinyin: "mianyang", py: "my", coords: [104.7417, 31.464], province: "四川省" },
  { name: "自贡市", pinyin: "zigong", py: "zg", coords: [104.7734, 29.3528], province: "四川省" },
  { name: "攀枝花市", pinyin: "panzhihua", py: "pzh", coords: [101.716, 26.5804], province: "四川省" },
  { name: "泸州市", pinyin: "luzhou", py: "lz", coords: [105.4433, 28.8891], province: "四川省" },
  { name: "德阳市", pinyin: "deyang", py: "dy", coords: [104.3986, 31.127], province: "四川省" },
  { name: "广元市", pinyin: "guangyuan", py: "gy", coords: [105.8297, 32.4337], province: "四川省" },
  { name: "遂宁市", pinyin: "suining", py: "sn", coords: [105.5713, 30.5133], province: "四川省" },
  { name: "内江市", pinyin: "neijiang", py: "nj", coords: [105.0661, 29.5871], province: "四川省" },
  { name: "乐山市", pinyin: "leshan", py: "ls", coords: [103.7613, 29.582], province: "四川省" },
  { name: "南充市", pinyin: "nanchong", py: "nc", coords: [106.0829, 30.7953], province: "四川省" },
  { name: "眉山市", pinyin: "meishan", py: "ms", coords: [103.8318, 30.0483], province: "四川省" },
  { name: "宜宾市", pinyin: "yibin", py: "yb", coords: [104.6308, 28.7602], province: "四川省" },
  { name: "广安市", pinyin: "guangan", py: "ga", coords: [106.6334, 30.4564], province: "四川省" },
  { name: "达州市", pinyin: "dazhou", py: "dz", coords: [107.5023, 31.2095], province: "四川省" },
  { name: "雅安市", pinyin: "yaan", py: "ya", coords: [103.001, 29.9877], province: "四川省" },
  { name: "巴中市", pinyin: "bazhong", py: "bz", coords: [106.7537, 31.8588], province: "四川省" },
  { name: "资阳市", pinyin: "ziyang", py: "zy", coords: [104.6419, 30.1222], province: "四川省" },
  { name: "阿坝藏族羌族自治州", pinyin: "aba", py: "ab", coords: [102.2214, 31.9056], province: "四川省" },
  { name: "甘孜藏族自治州", pinyin: "ganzi", py: "gz", coords: [101.9638, 30.0507], province: "四川省" },
  { name: "凉山彝族自治州", pinyin: "liangshan", py: "ls", coords: [102.2587, 27.8868], province: "四川省" },
  { name: "康定市", pinyin: "kangding", py: "kd", coords: [101.9647, 30.0489], province: "四川省" },
  { name: "四姑娘山镇", pinyin: "siguniangshan", py: "sgns", coords: [102.836, 30.998], province: "四川省" },
  { name: "都江堰市", pinyin: "dujiangyan", py: "djy", coords: [103.6194, 30.9982], province: "四川省" },
  { name: "西昌市", pinyin: "xichang", py: "xc", coords: [102.2641, 27.8953], province: "四川省" },
  { name: "稻城县", pinyin: "daocheng", py: "dc", coords: [100.2981, 29.0378], province: "四川省" },
  { name: "九寨沟县", pinyin: "jiuzhaigou", py: "jzg", coords: [104.2366, 33.2632], province: "四川省" },
  { name: "西安市", pinyin: "xian", py: "xa", coords: [108.9402, 34.3416], province: "陕西省" },
  { name: "铜川市", pinyin: "tongchuan", py: "tc", coords: [108.9631, 35.0833], province: "陕西省" },
  { name: "宝鸡市", pinyin: "baoji", py: "bj", coords: [107.1449, 34.3693], province: "陕西省" },
  { name: "咸阳市", pinyin: "xianyang", py: "xy", coords: [108.7051, 34.3299], province: "陕西省" },
  { name: "渭南市", pinyin: "weinan", py: "wn", coords: [109.5028, 34.4994], province: "陕西省" },
  { name: "延安市", pinyin: "yanan", py: "ya", coords: [109.4908, 36.5965], province: "陕西省" },
  { name: "汉中市", pinyin: "hanzhong", py: "hz", coords: [107.0286, 33.0777], province: "陕西省" },
  { name: "榆林市", pinyin: "yulin", py: "yl", coords: [109.7412, 38.2901], province: "陕西省" },
  { name: "安康市", pinyin: "ankang", py: "ak", coords: [109.0293, 32.6903], province: "陕西省" },
  { name: "商洛市", pinyin: "shangluo", py: "sl", coords: [109.9397, 33.8683], province: "陕西省" },
  { name: "昆明市", pinyin: "kunming", py: "km", coords: [102.8329, 24.8801], province: "云南省" },
  { name: "曲靖市", pinyin: "qujing", py: "qj", coords: [103.7978, 25.5015], province: "云南省" },
  { name: "玉溪市", pinyin: "yuxi", py: "yx", coords: [102.5439, 24.3504], province: "云南省" },
  { name: "保山市", pinyin: "baoshan", py: "bs", coords: [99.1671, 25.1205], province: "云南省" },
  { name: "昭通市", pinyin: "zhaotong", py: "zt", coords: [103.7172, 27.3369], province: "云南省" },
  { name: "丽江市", pinyin: "lijiang", py: "lj", coords: [100.233, 26.8721], province: "云南省" },
  { name: "普洱市", pinyin: "puer", py: "pe", coords: [100.9723, 22.7773], province: "云南省" },
  { name: "临沧市", pinyin: "lincang", py: "lc", coords: [100.0869, 23.8866], province: "云南省" },
  { name: "楚雄彝族自治州", pinyin: "chuxiong", py: "cx", coords: [101.546, 25.0419], province: "云南省" },
  { name: "红河哈尼族彝族自治州", pinyin: "honghe", py: "hh", coords: [103.3842, 23.3668], province: "云南省" },
  { name: "文山壮族苗族自治州", pinyin: "wenshan", py: "ws", coords: [104.2441, 23.3695], province: "云南省" },
  { name: "西双版纳傣族自治州", pinyin: "xishuangbanna", py: "xsbn", coords: [100.7979, 22.0017], province: "云南省" },
  { name: "大理白族自治州", pinyin: "dali", py: "dl", coords: [100.2256, 25.5894], province: "云南省" },
  { name: "德宏傣族景颇族自治州", pinyin: "dehong", py: "dh", coords: [98.5784, 24.4367], province: "云南省" },
  { name: "怒江傈僳族自治州", pinyin: "nujiang", py: "nj", coords: [98.8543, 25.8509], province: "云南省" },
  { name: "迪庆藏族自治州", pinyin: "diqing", py: "dq", coords: [99.7065, 27.8268], province: "云南省" },
  { name: "香格里拉市", pinyin: "xianggelila", py: "xgll", coords: [99.7073, 27.8251], province: "云南省" },
  { name: "腾冲市", pinyin: "tengchong", py: "tc", coords: [98.4941, 25.0254], province: "云南省" },
  { name: "贵阳市", pinyin: "guiyang", py: "gy", coords: [106.7135, 26.5783], province: "贵州省" },
  { name: "六盘水市", pinyin: "liupanshui", py: "lps", coords: [104.8467, 26.5846], province: "贵州省" },
  { name: "遵义市", pinyin: "zunyi", py: "zy", coords: [106.9373, 27.7066], province: "贵州省" },
  { name: "安顺市", pinyin: "anshun", py: "as", coords: [105.9321, 26.2455], province: "贵州省" },
  { name: "毕节市", pinyin: "bijie", py: "bj", coords: [105.285, 27.3017], province: "贵州省" },
  { name: "铜仁市", pinyin: "tongren", py: "tr", coords: [109.1915, 27.7183], province: "贵州省" },
  { name: "黔西南布依族苗族自治州", pinyin: "qianxinan", py: "qxn", coords: [104.8979, 25.0881], province: "贵州省" },
  { name: "黔东南苗族侗族自治州", pinyin: "qiandongnan", py: "qdn", coords: [107.9775, 26.5834], province: "贵州省" },
  { name: "黔南布依族苗族自治州", pinyin: "qiannan", py: "qn", coords: [107.5172, 26.2582], province: "贵州省" },
  { name: "拉萨市", pinyin: "lasa", py: "ls", coords: [91.1172, 29.6469], province: "西藏自治区" },
  { name: "日喀则市", pinyin: "rikaze", py: "rkz", coords: [88.8851, 29.2675], province: "西藏自治区" },
  { name: "昌都市", pinyin: "changdu", py: "cd", coords: [97.1785, 31.1369], province: "西藏自治区" },
  { name: "林芝市", pinyin: "linzhi", py: "lz", coords: [94.3623, 29.6547], province: "西藏自治区" },
  { name: "山南市", pinyin: "shannan", py: "sn", coords: [91.7665, 29.2361], province: "西藏自治区" },
  { name: "那曲市", pinyin: "naqu", py: "nq", coords: [92.0602, 31.476], province: "西藏自治区" },
  { name: "阿里地区", pinyin: "ali", py: "al", coords: [80.1055, 32.5037], province: "西藏自治区" },
  { name: "兰州市", pinyin: "lanzhou", py: "lz", coords: [103.8343, 36.0611], province: "甘肃省" },
  { name: "嘉峪关市", pinyin: "jiayuguan", py: "jyg", coords: [98.2773, 39.7865], province: "甘肃省" },
  { name: "金昌市", pinyin: "jinchang", py: "jc", coords: [102.1879, 38.5142], province: "甘肃省" },
  { name: "白银市", pinyin: "baiyin", py: "by", coords: [104.1736, 36.5456], province: "甘肃省" },
  { name: "天水市", pinyin: "tianshui", py: "ts", coords: [105.7249, 34.5785], province: "甘肃省" },
  { name: "武威市", pinyin: "wuwei", py: "ww", coords: [102.6347, 37.9299], province: "甘肃省" },
  { name: "张掖市", pinyin: "zhangye", py: "zy", coords: [100.4555, 38.9328], province: "甘肃省" },
  { name: "平凉市", pinyin: "pingliang", py: "pl", coords: [106.6847, 35.5427], province: "甘肃省" },
  { name: "酒泉市", pinyin: "jiuquan", py: "jq", coords: [98.5108, 39.744], province: "甘肃省" },
  { name: "庆阳市", pinyin: "qingyang", py: "qy", coords: [107.6384, 35.7342], province: "甘肃省" },
  { name: "定西市", pinyin: "dingxi", py: "dx", coords: [104.6263, 35.5796], province: "甘肃省" },
  { name: "陇南市", pinyin: "longnan", py: "ln", coords: [104.9294, 33.3886], province: "甘肃省" },
  { name: "临夏回族自治州", pinyin: "linxia", py: "lx", coords: [103.212, 35.5994], province: "甘肃省" },
  { name: "甘南藏族自治州", pinyin: "gannan", py: "gn", coords: [102.911, 34.9864], province: "甘肃省" },
  { name: "敦煌市", pinyin: "dunhuang", py: "dh", coords: [94.662, 40.1421], province: "甘肃省" },
  { name: "西宁市", pinyin: "xining", py: "xn", coords: [101.7789, 36.6231], province: "青海省" },
  { name: "海东市", pinyin: "haidong", py: "hd", coords: [102.1033, 36.5029], province: "青海省" },
  { name: "海北藏族自治州", pinyin: "haibei", py: "hb", coords: [100.9011, 36.9594], province: "青海省" },
  { name: "黄南藏族自治州", pinyin: "huangnan", py: "hn", coords: [102.0152, 35.5177], province: "青海省" },
  { name: "海南藏族自治州", pinyin: "hainan", py: "hn", coords: [100.6195, 36.2804], province: "青海省" },
  { name: "果洛藏族自治州", pinyin: "guoluo", py: "gl", coords: [100.2421, 34.4736], province: "青海省" },
  { name: "玉树藏族自治州", pinyin: "yushu", py: "ys", coords: [97.0085, 33.0062], province: "青海省" },
  { name: "海西蒙古族藏族自治州", pinyin: "haixi", py: "hx", coords: [97.3708, 37.3746], province: "青海省" },
  { name: "格尔木市", pinyin: "geermu", py: "gem", coords: [94.9033, 36.4024], province: "青海省" },
  { name: "银川市", pinyin: "yinchuan", py: "yc", coords: [106.2781, 38.4664], province: "宁夏回族自治区" },
  { name: "石嘴山市", pinyin: "shizuishan", py: "szs", coords: [106.3762, 39.0133], province: "宁夏回族自治区" },
  { name: "吴忠市", pinyin: "wuzhong", py: "wz", coords: [106.1994, 37.9862], province: "宁夏回族自治区" },
  { name: "固原市", pinyin: "guyuan", py: "gy", coords: [106.2852, 36.0046], province: "宁夏回族自治区" },
  { name: "中卫市", pinyin: "zhongwei", py: "zw", coords: [105.1896, 37.5149], province: "宁夏回族自治区" },
  { name: "乌鲁木齐市", pinyin: "wulumuqi", py: "wlmq", coords: [87.6177, 43.7928], province: "新疆维吾尔自治区" },
  { name: "克拉玛依市", pinyin: "kelamayi", py: "klmy", coords: [84.8739, 45.5959], province: "新疆维吾尔自治区" },
  { name: "吐鲁番市", pinyin: "tulufan", py: "tlf", coords: [89.1841, 42.9476], province: "新疆维吾尔自治区" },
  { name: "哈密市", pinyin: "hami", py: "hm", coords: [93.5132, 42.8332], province: "新疆维吾尔自治区" },
  { name: "昌吉回族自治州", pinyin: "changji", py: "cj", coords: [87.304, 44.0146], province: "新疆维吾尔自治区" },
  { name: "博尔塔拉蒙古自治州", pinyin: "boertala", py: "betl", coords: [82.0748, 44.9033], province: "新疆维吾尔自治区" },
  { name: "巴音郭楞蒙古自治州", pinyin: "bayinguoleng", py: "bygl", coords: [86.15, 41.7641], province: "新疆维吾尔自治区" },
  { name: "阿克苏地区", pinyin: "akesu", py: "aks", coords: [80.2651, 41.1707], province: "新疆维吾尔自治区" },
  { name: "克孜勒苏柯尔克孜自治州", pinyin: "kezilesu", py: "kzls", coords: [76.1728, 39.7134], province: "新疆维吾尔自治区" },
  { name: "喀什地区", pinyin: "kashi", py: "ks", coords: [75.9891, 39.4677], province: "新疆维吾尔自治区" },
  { name: "和田地区", pinyin: "hetian", py: "ht", coords: [79.9253, 37.1107], province: "新疆维吾尔自治区" },
  { name: "伊犁哈萨克自治州", pinyin: "yili", py: "yl", coords: [81.3179, 43.9219], province: "新疆维吾尔自治区" },
  { name: "塔城地区", pinyin: "tacheng", py: "tc", coords: [82.9857, 46.7463], province: "新疆维吾尔自治区" },
  { name: "阿勒泰地区", pinyin: "aletai", py: "alt", coords: [88.1396, 47.8484], province: "新疆维吾尔自治区" },
  { name: "呼和浩特市", pinyin: "huhehaote", py: "hhht", coords: [111.6708, 40.8183], province: "内蒙古自治区" },
  { name: "包头市", pinyin: "baotou", py: "bt", coords: [109.8404, 40.6582], province: "内蒙古自治区" },
  { name: "乌海市", pinyin: "wuhai", py: "wh", coords: [106.8247, 39.6737], province: "内蒙古自治区" },
  { name: "赤峰市", pinyin: "chifeng", py: "cf", coords: [118.9568, 42.2753], province: "内蒙古自治区" },
  { name: "通辽市", pinyin: "tongliao", py: "tl", coords: [122.2631, 43.6174], province: "内蒙古自治区" },
  { name: "鄂尔多斯市", pinyin: "eerduosi", py: "eeds", coords: [109.9903, 39.8172], province: "内蒙古自治区" },
  { name: "呼伦贝尔市", pinyin: "hulunbeier", py: "hlbe", coords: [119.7582, 49.2153], province: "内蒙古自治区" },
  { name: "巴彦淖尔市", pinyin: "bayannaoer", py: "byne", coords: [107.4169, 40.7574], province: "内蒙古自治区" },
  { name: "乌兰察布市", pinyin: "wulanchabu", py: "wlcb", coords: [113.1145, 41.0341], province: "内蒙古自治区" },
  { name: "兴安盟", pinyin: "xinganmeng", py: "xam", coords: [122.0703, 46.0763], province: "内蒙古自治区" },
  { name: "锡林郭勒盟", pinyin: "xilinguolemeng", py: "xlglm", coords: [116.0909, 43.944], province: "内蒙古自治区" },
  { name: "阿拉善盟", pinyin: "alashanmeng", py: "alsm", coords: [105.7064, 38.8448], province: "内蒙古自治区" },
  { name: "沈阳市", pinyin: "shenyang", py: "sy", coords: [123.429, 41.7967], province: "辽宁省" },
  { name: "大连市", pinyin: "dalian", py: "dl", coords: [121.6186, 38.9146], province: "辽宁省" },
  { name: "鞍山市", pinyin: "anshan", py: "as", coords: [122.9956, 41.1106], province: "辽宁省" },
  { name: "抚顺市", pinyin: "fushun", py: "fs", coords: [123.9211, 41.8759], province: "辽宁省" },
  { name: "本溪市", pinyin: "benxi", py: "bx", coords: [123.738, 41.2941], province: "辽宁省" },
  { name: "丹东市", pinyin: "dandong", py: "dd", coords: [124.3838, 40.129], province: "辽宁省" },
  { name: "锦州市", pinyin: "jinzhou", py: "jz", coords: [121.127, 41.0951], province: "辽宁省" },
  { name: "营口市", pinyin: "yingkou", py: "yk", coords: [122.2352, 40.667], province: "辽宁省" },
  { name: "阜新市", pinyin: "fuxin", py: "fx", coords: [121.6489, 42.0118], province: "辽宁省" },
  { name: "辽阳市", pinyin: "liaoyang", py: "ly", coords: [123.1732, 41.2694], province: "辽宁省" },
  { name: "盘锦市", pinyin: "panjin", py: "pj", coords: [122.0696, 41.1245], province: "辽宁省" },
  { name: "铁岭市", pinyin: "tieling", py: "tl", coords: [123.8443, 42.2905], province: "辽宁省" },
  { name: "朝阳市", pinyin: "chaoyang", py: "cy", coords: [120.4511, 41.5768], province: "辽宁省" },
  { name: "葫芦岛市", pinyin: "huludao", py: "hld", coords: [120.8564, 40.7556], province: "辽宁省" },
  { name: "长春市", pinyin: "changchun", py: "cc", coords: [125.3245, 43.8868], province: "吉林省" },
  { name: "吉林市", pinyin: "jilin", py: "jl", coords: [126.553, 43.8436], province: "吉林省" },
  { name: "四平市", pinyin: "siping", py: "sp", coords: [124.3708, 43.1703], province: "吉林省" },
  { name: "辽源市", pinyin: "liaoyuan", py: "ly", coords: [125.1453, 42.9027], province: "吉林省" },
  { name: "通化市", pinyin: "tonghua", py: "th", coords: [125.9365, 41.7212], province: "吉林省" },
  { name: "白山市", pinyin: "baishan", py: "bs", coords: [126.4278, 41.9423], province: "吉林省" },
  { name: "松原市", pinyin: "songyuan", py: "sy", coords: [124.8236, 45.1183], province: "吉林省" },
  { name: "白城市", pinyin: "baicheng", py: "bc", coords: [122.8411, 45.619], province: "吉林省" },
  { name: "延边朝鲜族自治州", pinyin: "yanbian", py: "yb", coords: [129.5132, 42.9048], province: "吉林省" },
  { name: "哈尔滨市", pinyin: "haerbin", py: "hrb", coords: [126.6424, 45.7569], province: "黑龙江省" },
  { name: "齐齐哈尔市", pinyin: "qiqihaer", py: "qqhe", coords: [123.9579, 47.3421], province: "黑龙江省" },
  { name: "鸡西市", pinyin: "jixi", py: "jx", coords: [130.9759, 45.3], province: "黑龙江省" },
  { name: "鹤岗市", pinyin: "hegang", py: "hg", coords: [130.2775, 47.3321], province: "黑龙江省" },
  { name: "双鸭山市", pinyin: "shuangyashan", py: "sys", coords: [131.1573, 46.6434], province: "黑龙江省" },
  { name: "大庆市", pinyin: "daqing", py: "dq", coords: [125.1127, 46.5879], province: "黑龙江省" },
  { name: "伊春市", pinyin: "yichun", py: "yc", coords: [128.8994, 47.7248], province: "黑龙江省" },
  { name: "佳木斯市", pinyin: "jiamusi", py: "jms", coords: [130.3616, 46.8096], province: "黑龙江省" },
  { name: "七台河市", pinyin: "qitaihe", py: "qth", coords: [131.0155, 45.7713], province: "黑龙江省" },
  { name: "牡丹江市", pinyin: "mudanjiang", py: "mdj", coords: [129.6186, 44.583], province: "黑龙江省" },
  { name: "黑河市", pinyin: "heihe", py: "hh", coords: [127.499, 50.2496], province: "黑龙江省" },
  { name: "绥化市", pinyin: "suihua", py: "sh", coords: [126.9929, 46.6374], province: "黑龙江省" },
  { name: "大兴安岭地区", pinyin: "daxinganling", py: "dxal", coords: [124.7115, 52.3353], province: "黑龙江省" },
  { name: "南宁市", pinyin: "nanning", py: "nn", coords: [108.32, 22.824], province: "广西壮族自治区" },
  { name: "柳州市", pinyin: "liuzhou", py: "lz", coords: [109.4117, 24.3146], province: "广西壮族自治区" },
  { name: "桂林市", pinyin: "guilin", py: "gl", coords: [110.2991, 25.2742], province: "广西壮族自治区" },
  { name: "梧州市", pinyin: "wuzhou", py: "wz", coords: [111.2976, 23.4748], province: "广西壮族自治区" },
  { name: "北海市", pinyin: "beihai", py: "bh", coords: [109.1193, 21.4733], province: "广西壮族自治区" },
  { name: "防城港市", pinyin: "fangchenggang", py: "fcg", coords: [108.3455, 21.6146], province: "广西壮族自治区" },
  { name: "钦州市", pinyin: "qinzhou", py: "qz", coords: [108.6242, 21.9671], province: "广西壮族自治区" },
  { name: "贵港市", pinyin: "guigang", py: "gg", coords: [109.6021, 23.0936], province: "广西壮族自治区" },
  { name: "玉林市", pinyin: "yulin", py: "yl", coords: [110.1544, 22.6314], province: "广西壮族自治区" },
  { name: "百色市", pinyin: "baise", py: "bs", coords: [106.6163, 23.8977], province: "广西壮族自治区" },
  { name: "贺州市", pinyin: "hezhou", py: "hz", coords: [111.5521, 24.4141], province: "广西壮族自治区" },
  { name: "河池市", pinyin: "hechi", py: "hc", coords: [108.0621, 24.6959], province: "广西壮族自治区" },
  { name: "来宾市", pinyin: "laibin", py: "lb", coords: [109.2298, 23.7338], province: "广西壮族自治区" },
  { name: "崇左市", pinyin: "chongzuo", py: "cz", coords: [107.3539, 22.4041], province: "广西壮族自治区" },
  { name: "阳朔县", pinyin: "yangshuo", py: "ys", coords: [110.4947, 24.7766], province: "广西壮族自治区" },
  { name: "海口市", pinyin: "haikou", py: "hk", coords: [110.3312, 20.0319], province: "海南省" },
  { name: "三亚市", pinyin: "sanya", py: "sy", coords: [109.5083, 18.2479], province: "海南省" },
  { name: "三沙市", pinyin: "sansha", py: "ss", coords: [112.3488, 16.8387], province: "海南省" },
  { name: "儋州市", pinyin: "danzhou", py: "dz", coords: [109.5768, 19.5175], province: "海南省" },
  { name: "香港特别行政区", pinyin: "xianggang", py: "xg", coords: [114.1654, 22.2753], province: "香港" },
  { name: "澳门特别行政区", pinyin: "aomen", py: "am", coords: [113.5491, 22.1987], province: "澳门" },
  { name: "台北市", pinyin: "taibei", py: "tb", coords: [121.5654, 25.033], province: "台湾省" },
  { name: "高雄市", pinyin: "gaoxiong", py: "gx", coords: [120.3014, 22.6273], province: "台湾省" },
  { name: "台中市", pinyin: "taizhong", py: "tz", coords: [120.6736, 24.1477], province: "台湾省" }
];

// 3. 著名山峰 POI (全国著名山脉高峰)
const MOUNTAIN_POIS = [
  { name: '泰山 · 玉皇顶', pinyin: 'taishan', py: 'ts', ele: 1545, coords: [117.1042, 36.2519] },
  { name: '华山 · 南峰落雁', pinyin: 'huashan', py: 'hs', ele: 2154, coords: [110.0820, 34.4780] },
  { name: '四姑娘山 · 幺妹峰', pinyin: 'siguniangshan', py: 'sgns', ele: 6250, coords: [102.9020, 31.1060] },
  { name: '贡嘎山 · 蜀山之王', pinyin: 'gonggashan', py: 'ggs', ele: 7556, coords: [101.8780, 29.5960] },
  { name: '珠穆朗玛峰 · 世界之巅', pinyin: 'zhumulangma', py: 'zmlm', ele: 8848, coords: [86.9250, 27.9880] },
  { name: '冈仁波齐 · 万山之祖', pinyin: 'gangrenboqi', py: 'grbq', ele: 6638, coords: [81.3120, 31.0670] },
  { name: '玉龙雪山 · 扇子陡', pinyin: 'yulongxueshan', py: 'ylxs', ele: 5596, coords: [100.1780, 27.0980] },
  { name: '梅里雪山 · 卡瓦格博', pinyin: 'meilixueshan', py: 'mlxs', ele: 6740, coords: [98.6920, 28.4420] },
  { name: '黄山 · 莲花峰', pinyin: 'huangshan', py: 'hs', ele: 1864, coords: [118.1750, 30.1330] },
  { name: '峨眉山 · 万佛顶', pinyin: 'emeishan', py: 'ems', ele: 3099, coords: [103.3320, 29.5210] },
  { name: '长白山 · 白云峰', pinyin: 'changbaishan', py: 'cbs', ele: 2691, coords: [128.0580, 41.9930] },
  { name: '祁连山 · 团结峰', pinyin: 'qilianshan', py: 'qls', ele: 5808, coords: [97.5830, 38.5000] },
  { name: '神农架 · 神农顶', pinyin: 'shennongjia', py: 'snj', ele: 3106, coords: [110.3000, 31.4500] },
  { name: '五台山 · 北台叶斗峰', pinyin: 'wutaishan', py: 'wts', ele: 3061, coords: [113.5900, 39.0600] },
  { name: '崂山 · 巨峰', pinyin: 'laoshan', py: 'ls', ele: 1132, coords: [120.6120, 36.1750] }
];

let mapInstance = null;
let currentExaggeration = 2.0;
let currentStyle = 'outmap';
let is3DView = true;
let isPitchLocked = true;
let updatePitchLockFn = null;

let provinceMarkers = [];
let cityMarkers = [];
let mountainMarkers = [];
let localServerPort = 28795;

// 离线瓦片计数格式化 (支持中文“万/亿”与体积清晰表达，彻底消除 200k 与 200KB 的误解)
function formatTileCount(n) {
  if (n === null || n === undefined || isNaN(n)) return '0';
  const num = Number(n);
  if (num < 1000) return num.toString();
  if (num < 10000) {
    const k = (num / 1000).toFixed(1).replace(/\.0$/, '');
    return `${k}k`;
  }
  if (num < 100000000) {
    const wan = (num / 10000).toFixed(1).replace(/\.0$/, '');
    return `${wan}万`;
  }
  const yi = (num / 100000000).toFixed(1).replace(/\.0$/, '');
  return `${yi}亿`;
}

function formatBytes(bytes) {
  if (!bytes || isNaN(bytes) || bytes <= 0) return '';
  if (bytes >= 1073741824) {
    return (bytes / 1073741824).toFixed(1) + ' GB';
  }
  if (bytes >= 1048576) {
    return (bytes / 1048576).toFixed(1) + ' MB';
  }
  return (bytes / 1024).toFixed(0) + ' KB';
}

function formatTileDisplay(count, bytes) {
  const countStr = formatTileCount(count);
  if (bytes && bytes > 0) {
    return `${countStr} (${formatBytes(bytes)})`;
  }
  if (count >= 10000) {
    const estBytes = count * 38000;
    return `${countStr} (${formatBytes(estBytes)})`;
  }
  return countStr;
}

// 智能双向合并算法 (本地与云端求并集，确保双方新加的数据均不丢失)
function mergeWaypoints(localList = [], cloudList = []) {
  const map = new Map();
  (cloudList || []).forEach(item => {
    if (!item) return;
    const key = item.id || `${item.name}_${(item.coords || []).join(',')}`;
    map.set(key, item);
  });
  (localList || []).forEach(item => {
    if (!item) return;
    const key = item.id || `${item.name}_${(item.coords || []).join(',')}`;
    map.set(key, item);
  });
  return Array.from(map.values());
}

function mergeRoutes(localList = [], cloudList = []) {
  const map = new Map();
  (cloudList || []).forEach(item => {
    if (!item) return;
    const key = item.id || `${item.name}_${item.distance}`;
    map.set(key, item);
  });
  (localList || []).forEach(item => {
    if (!item) return;
    const key = item.id || `${item.name}_${item.distance}`;
    map.set(key, item);
  });
  return Array.from(map.values());
}

function mergeFolders(localList = [], cloudList = []) {
  const set = new Set();
  const res = [];
  [...(cloudList || []), ...(localList || [])].forEach(f => {
    const val = typeof f === 'string' ? f : (f && f.name);
    if (val && !set.has(val)) {
      set.add(val);
      res.push(f);
    }
  });
  return res;
}

async function initApplication() {
  let port = 28795;
  let totalOfflineCount = 0;
  let totalOfflineBytes = 0;

  if (window.electronAPI) {
    try {
      const info = await window.electronAPI.getTileServerInfo();
      if (info) {
        port = info.port;
        localServerPort = info.port;
        totalOfflineCount = info.totalTiles || ((info.demCount || 0) + (info.vectorCount || 0) + (info.satCount || 0));
        totalOfflineBytes = info.totalBytes || 0;
      }
    } catch (e) {}

    try {
      await syncOfflineManifest();
    } catch (e) {}

    // 启动时静默检查并智能双向合并 R2 云端漫游数据
    try {
      if (window.electronAPI && window.electronAPI.pullCloudSyncData) {
        let syncKey = 'default';
        if (window.electronAPI.getCloudSyncConfig) {
          const syncCfg = await window.electronAPI.getCloudSyncConfig();
          if (syncCfg) {
            if (syncCfg.autoSync === false) syncKey = null; // 用户关闭了自动漫游
            else if (syncCfg.syncKey) syncKey = syncCfg.syncKey;
          }
        }
        if (syncKey) {
          const syncRes = await window.electronAPI.pullCloudSyncData({ syncKey });
          if (syncRes && syncRes.success && syncRes.data) {
            const d = syncRes.data;
            const localFavs = JSON.parse(localStorage.getItem('outmap_saved_waypoints') || '[]');
            const localRoutes = JSON.parse(localStorage.getItem('outmap_saved_routes') || '[]');
            const localFolders = JSON.parse(localStorage.getItem('outmap_custom_folders') || '[]');

            const mergedFavs = mergeWaypoints(localFavs, d.favorites);
            const mergedRoutes = mergeRoutes(localRoutes, d.routes);
            const mergedFolders = mergeFolders(localFolders, d.folders);

            localStorage.setItem('outmap_saved_waypoints', JSON.stringify(mergedFavs));
            localStorage.setItem('outmap_saved_routes', JSON.stringify(mergedRoutes));
            localStorage.setItem('outmap_custom_folders', JSON.stringify(mergedFolders));

            if (d.settings && d.settings.pitchLocked !== undefined) {
              localStorage.setItem('outmap_pitch_locked', d.settings.pitchLocked ? '1' : '0');
              if (d.settings.lockedPitchVal) {
                localStorage.setItem('outmap_locked_pitch_val', String(d.settings.lockedPitchVal));
              }
            }
            console.log('[CloudSync] 启动自动双向合并云端漫游数据成功');
          }
        }
      }
    } catch (e) {}
  }

  const isWebMode = !window.electronAPI;
  if (isWebMode) {
    document.body.classList.add('web-mode');
    document.documentElement.classList.add('web-mode');
    const dlBtn = document.getElementById('btn-open-pyramid-dl');
    if (dlBtn) dlBtn.style.display = 'none';
  }

  const titleStat = document.getElementById('titlebar-cache-stat');
  if (titleStat) {
    if (isWebMode) {
      titleStat.style.display = 'none';
    } else {
      titleStat.innerText = `离线: ${formatTileDisplay(totalOfflineCount, totalOfflineBytes)}`;
      titleStat.title = `本地已缓存离线切片: ${totalOfflineCount.toLocaleString()} 块${totalOfflineBytes ? ` · 占用空间: ${formatBytes(totalOfflineBytes)}` : ''} (点击可重新校准磁盘)`;

      titleStat.addEventListener('click', async () => {
        titleStat.innerText = '离线: 扫描中...';
        try {
          if (window.electronAPI && window.electronAPI.rescanOfflineTiles) {
            const stats = await window.electronAPI.rescanOfflineTiles();
            if (stats) {
              totalOfflineCount = stats.totalTiles || 0;
              totalOfflineBytes = stats.totalBytes || 0;
              titleStat.innerText = `离线: ${formatTileDisplay(totalOfflineCount, totalOfflineBytes)}`;
              titleStat.title = `本地已缓存离线切片: ${totalOfflineCount.toLocaleString()} 块 · 占用空间: ${formatBytes(totalOfflineBytes)} (点击可重新校准磁盘)`;
            }
          }
        } catch (e) {
          titleStat.innerText = `离线: ${formatTileDisplay(totalOfflineCount, totalOfflineBytes)}`;
        }
      });
    }
  }

  // 瓦片 API 体系：在 Electron 下默认使用本地离线服务；在 Web 纯网页端直连在线瓦片 CDN
  // 瓦片 API 体系：在 Electron 下默认使用本地离线服务；在 Web 纯网页端直连在线瓦片 CDN
  let demUrl = `http://127.0.0.1:${port}/dem/{z}/{x}/{y}.webp`;
  let vecUrl = `http://127.0.0.1:${port}/vector/{z}/{x}/{y}.pbf`;
  let glyphsUrl = `http://127.0.0.1:${port}/fonts/{fontstack}/{range}.pbf`;
  let chinaBoundaryUrl = `http://127.0.0.1:${port}/china-boundary.json`;

  if (isWebMode) {
    chinaBoundaryUrl = './china-boundary.json';

    // 默认高可用全球免 Key 在线 CDN (OpenFreeMap + Mapterhorn Terrarium DEM)
    // 零服务器依赖，全球 300+ 边缘节点毫秒级直连，任何设备浏览器开箱即用
    const onlineDem = 'https://tiles.mapterhorn.com/{z}/{x}/{y}.webp';
    const onlineVec = 'https://tiles.openfreemap.org/planet/20260830_080001_pt/{z}/{x}/{y}.pbf';
    const onlineGlyphs = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';

    demUrl = onlineDem;
    vecUrl = onlineVec;
    glyphsUrl = onlineGlyphs;

    // 清除旧版本误存的前端域名自定义瓦片源配置
    if (localStorage.getItem('outmap_custom_tile_api') === 'https://map.053999.xyz') {
      localStorage.removeItem('outmap_custom_tile_api');
    }

    // 若用户显式配置了独立的自建瓦片服务后端，且该后端不等于当前前端页面域名
    const userCustomTileApi = localStorage.getItem('outmap_custom_tile_api');
    if (userCustomTileApi && !userCustomTileApi.includes(window.location.hostname)) {
      try {
        const cleanApi = userCustomTileApi.replace(/\/+$/, '');
        const probe = await fetch(`${cleanApi}/vector/0/0/0.pbf`, { method: 'HEAD', signal: AbortSignal.timeout(1500) }).catch(() => null);
        if (probe && probe.ok) {
          vecUrl = `${cleanApi}/vector/{z}/{x}/{y}.pbf`;
          demUrl = `${cleanApi}/dem/{z}/{x}/{y}.webp`;
          glyphsUrl = `${cleanApi}/fonts/{fontstack}/{range}.pbf`;
          console.log(`[Online Mode] 已成功连接自定义自建瓦片后端: ${cleanApi}`);
        }
      } catch (e) {
        console.warn(`[Online Mode] 自建瓦片后端暂不可达，保持使用高可用全球 CDN`);
      }
    }
  }

  // 1. 核心并发渲染调优：为核显与主渲染线程保留核心余量，消除平移卡顿与输入延迟
  maplibregl.workerCount = Math.min(4, Math.max(2, (navigator.hardwareConcurrency || 4) - 2));

  // 初始化 DEM 高程数据源 (工作站模式：扩大高程网格缓存至 5000 片，反复缩放平移零延迟)
  const demSource = new mlcontour.DemSource({
    url: demUrl,
    encoding: 'terrarium',
    maxzoom: 12,
    worker: true,
    cacheSize: 5000,
    timeoutMs: 12000
  });
  demSource.setupMaplibre(maplibregl);

  // 2. 初始化 MapLibre 地图实例 (工作站模式：扩大 GPU 显存纹理池至 4000 片，杜绝白块)
  mapInstance = new maplibregl.Map({
    container: 'map',
    center: [104.5000, 36.0000],
    zoom: 4.45,
    pitch: 50,
    bearing: 0,
    minZoom: 4.1, // 缩放锁定在中国大陆框架黄金视野，防止无意义过度缩放看到南半球/澳大利亚
    maxBounds: [[65.0, 14.0], [145.0, 56.0]], // 中国大陆框架地理边界约束（南限14°N，绝不漂移至赤道与澳洲）
    maxPitch: 85,
    fadeDuration: 0, // 彻底消除跨层级缩放时的 300ms 标签淡入淡出闪烁
    localIdeographFontFamily: 'Microsoft YaHei, "PingFang SC", "Noto Sans CJK SC", sans-serif', // 本地系统字体瞬时光栅化，零延迟零丢字零闪烁
    attributionControl: false,
    renderWorldCopies: false, // 禁用经度环绕复制，削减 50% 无效 Draw Call
    maxTileCacheSize: 4000,   // 解锁 GPU 显存纹理缓存容量至 4000 片
    style: {
      version: 8,
      glyphs: glyphsUrl,
      sources: {},
      layers: [
        {
          id: 'background',
          type: 'background',
          paint: {
            'background-color': '#f2ede5'
          }
        }
      ]
    }
  });

  const map = mapInstance;
  window.mapInstance = map;
  if (typeof map.setPrefetchZoomDelta === 'function') {
    map.setPrefetchZoomDelta(2); // 缩放时双向预加载 2 个层级的高程与纹理网格
  }

  map.on('load', () => {
    // 3D 地形高度网格
    map.addSource('terrain-dem', {
      type: 'raster-dem',
      tiles: [demSource.sharedDemProtocolUrl],
      encoding: 'terrarium',
      tileSize: 256,
      maxzoom: 12
    });

    map.setTerrain({
      source: 'terrain-dem',
      exaggeration: currentExaggeration
    });

    // DEM高程图立体光照阴影渲染 (Apple Maps / Topo 柔和自然阴影，杜绝 OLED 强光刺眼)
    map.addLayer({
      id: 'hillshade-layer',
      type: 'hillshade',
      source: 'terrain-dem',
      paint: {
        'hillshade-exaggeration': 0.65,
        'hillshade-highlight-color': '#ffffff',
        'hillshade-shadow-color': '#5a685c',
        'hillshade-accent-color': '#e2eae0'
      }
    });

    // 全量矢量地理要素源
    map.addSource('osm-vector-source', {
      type: 'vector',
      tiles: [vecUrl],
      maxzoom: 14
    });

    // 居住区/小区/住宅区功能用地轮廓 (Apple Maps 雅致暖灰)
    map.addLayer({
      id: 'osm-landuse-residential',
      type: 'fill',
      source: 'osm-vector-source',
      'source-layer': 'landuse',
      filter: ['match', ['get', 'class'], ['residential', 'suburb'], true, false],
      paint: {
        'fill-color': '#ebe6de',
        'fill-opacity': 0.45
      }
    });

    map.addLayer({
      id: 'osm-landuse-commercial',
      type: 'fill',
      source: 'osm-vector-source',
      'source-layer': 'landuse',
      filter: ['match', ['get', 'class'], ['commercial', 'industrial', 'school', 'hospital'], true, false],
      paint: {
        'fill-color': '#f2eee6',
        'fill-opacity': 0.35
      }
    });

    // 森林与自然植被 (Apple Maps 经典鼠尾草柔绿，护眼舒适)
    map.addLayer({
      id: 'osm-forest-layer',
      type: 'fill',
      source: 'osm-vector-source',
      'source-layer': 'landcover',
      filter: ['match', ['get', 'class'], ['wood', 'forest', 'scrub', 'grass'], true, false],
      paint: {
        'fill-color': '#cbe6c4',
        'fill-opacity': 0.55
      }
    });

    // 湖泊水库 (Apple Maps 柔和恬静石板天蓝，彻底替换刺眼高亮青蓝)
    map.addLayer({
      id: 'osm-water-layer',
      type: 'fill',
      source: 'osm-vector-source',
      'source-layer': 'water',
      paint: {
        'fill-color': '#9dc2e8',
        'fill-opacity': 0.9
      }
    });

    // 河流水系 (Apple Maps 柔和水系主线)
    map.addLayer({
      id: 'osm-waterway-layer',
      type: 'line',
      source: 'osm-vector-source',
      'source-layer': 'waterway',
      paint: {
        'line-color': '#7fa8d8',
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1.0, 10, 2.0, 14, 3.2],
        'line-opacity': 0.85
      }
    });

    // 湖泊、水库大水系名称注记 (Apple Maps 雅致水系文字)
    map.addLayer({
      id: 'osm-water-names',
      type: 'symbol',
      source: 'osm-vector-source',
      'source-layer': 'water_name',
      minzoom: 5,
      layout: {
        'text-field': ['coalesce', ['get', 'name:zh'], ['get', 'name_zh'], ['get', 'name']],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 5, 9.5, 9, 11, 13, 13],
        'text-anchor': 'center'
      },
      paint: {
        'text-color': '#456e99',
        'text-halo-color': '#ffffff',
        'text-halo-width': 2.5
      }
    });

    // 沿河流走向的江河溪流水系注记
    map.addLayer({
      id: 'osm-waterway-names',
      type: 'symbol',
      source: 'osm-vector-source',
      'source-layer': 'waterway',
      filter: ['has', 'name'],
      minzoom: 6,
      layout: {
        'symbol-placement': 'line',
        'text-field': ['coalesce', ['get', 'name:zh'], ['get', 'name_zh'], ['get', 'name']],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 6, 9.0, 10, 11, 14, 12.5],
        'symbol-spacing': 240,
        'text-max-angle': 45,
        'text-keep-upright': true
      },
      paint: {
        'text-color': '#456e99',
        'text-halo-color': '#ffffff',
        'text-halo-width': 2.5
      }
    });

    // =========================================================
    // 中国国家法定标准国界与十段线系统 (标准 WGS-84 坐标，严防缩放偏差与错位)
    // 兼备：微观米级贴合 (切片 boundary 图层) 与 宏观标准法定版图 (十段线与标准陆界)
    // =========================================================
    map.addSource('china-boundary-source', {
      type: 'geojson',
      data: chinaBoundaryUrl
    });

    // 1. 省级行政区界线 (底图原生矢量切片，Zoom 4+ 优雅显现)
    map.addLayer({
      id: 'osm-boundary-province',
      type: 'line',
      source: 'osm-vector-source',
      'source-layer': 'boundary',
      filter: ['==', ['get', 'admin_level'], 4],
      minzoom: 4,
      paint: {
        'line-color': '#94a3b8',
        'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.8, 8, 1.4, 12, 1.8],
        'line-dasharray': [4, 2],
        'line-opacity': 0.75
      }
    });

    // 2. 底图切片全球国界底层纯白轮廓 (消除锯齿，赋予微观立体感)
    map.addLayer({
      id: 'osm-boundary-country-casing',
      type: 'line',
      source: 'osm-vector-source',
      'source-layer': 'boundary',
      filter: ['==', ['get', 'admin_level'], 2],
      minzoom: 3,
      paint: {
        'line-color': '#ffffff',
        'line-width': ['interpolate', ['linear'], ['zoom'], 3, 2.5, 6, 3.8, 10, 5.5],
        'line-opacity': 0.75
      }
    });

    // 3. 底图切片全球国界主线 (微观视口下，沿江沿脊严格贴合，0 偏差)
    map.addLayer({
      id: 'osm-boundary-country',
      type: 'line',
      source: 'osm-vector-source',
      'source-layer': 'boundary',
      filter: ['==', ['get', 'admin_level'], 2],
      minzoom: 3,
      paint: {
        'line-color': '#7f1d1d',
        'line-width': ['interpolate', ['linear'], ['zoom'], 3, 1.2, 6, 2.0, 10, 3.2],
        'line-dasharray': [6, 2.5, 2, 2.5],
        'line-opacity': 0.85
      }
    });

    // 4. 中国国家法定标准陆地国界 - 柔白高对比底衬
    map.addLayer({
      id: 'china-boundary-national-casing',
      type: 'line',
      source: 'china-boundary-source',
      filter: ['==', ['get', 'type'], 'boundary'],
      paint: {
        'line-color': '#ffffff',
        'line-width': ['interpolate', ['linear'], ['zoom'], 1, 2.6, 5, 4.0, 9, 5.8],
        'line-opacity': 0.88
      }
    });

    // 5. 中国国家法定标准陆地国界 - 权威朱红主线 (自然资源部标准色)
    map.addLayer({
      id: 'china-boundary-national-line',
      type: 'line',
      source: 'china-boundary-source',
      filter: ['==', ['get', 'type'], 'boundary'],
      paint: {
        'line-color': '#991b1b',
        'line-width': ['interpolate', ['linear'], ['zoom'], 1, 1.4, 5, 2.4, 9, 3.6],
        'line-opacity': 0.95
      }
    });

    // 6. 中国南海诸岛十段线 - 柔白底衬
    map.addLayer({
      id: 'china-boundary-ten-dash-casing',
      type: 'line',
      source: 'china-boundary-source',
      filter: ['==', ['get', 'type'], 'ten_dash_line'],
      paint: {
        'line-color': '#ffffff',
        'line-width': ['interpolate', ['linear'], ['zoom'], 1, 3.0, 5, 4.8, 9, 6.5],
        'line-opacity': 0.9
      }
    });

    // 7. 中国南海诸岛十段线 - 权威规范断续线
    map.addLayer({
      id: 'china-boundary-ten-dash-line',
      type: 'line',
      source: 'china-boundary-source',
      filter: ['==', ['get', 'type'], 'ten_dash_line'],
      paint: {
        'line-color': '#991b1b',
        'line-width': ['interpolate', ['linear'], ['zoom'], 1, 1.8, 5, 3.0, 9, 4.2],
        'line-opacity': 1.0
      }
    });

    // 地形等高线 (全缩放层级无缝覆盖，Zoom 6 起清晰显现山地宏观走势，近景至 L15+ 细腻呈现)
    map.addSource('contour-source', {
      type: 'vector',
      tiles: [
        demSource.contourProtocolUrl({
          multiplier: 1,
          thresholds: {
            6: [1000, 2500],
            8: [500, 2000],
            10: [200, 1000],
            11: [100, 500],
            12: [100, 500],
            13: [50, 250],
            14: [20, 100],
            15: [10, 50]
          },
          elevationKey: 'ele',
          levelKey: 'level'
        })
      ],
      maxzoom: 15
    });

    map.addLayer({
      id: 'contour-lines',
      type: 'line',
      source: 'contour-source',
      'source-layer': 'contours',
      minzoom: 6,
      paint: {
        'line-color': '#65a30d',
        'line-width': ['match', ['get', 'level'], 1, 1.2, 0.6],
        'line-opacity': 0.55
      }
    });

    map.addLayer({
      id: 'contour-labels',
      type: 'symbol',
      source: 'contour-source',
      'source-layer': 'contours',
      minzoom: 8,
      filter: ['==', ['get', 'level'], 1],
      layout: {
        'symbol-placement': 'line',
        'text-field': ['concat', ['to-string', ['get', 'ele']], 'm'],
        'text-font': ['Noto Sans Regular'],
        'text-size': 9,
        'symbol-spacing': 550
      },
      paint: {
        'text-color': '#4d7c0f',
        'text-halo-color': '#ffffff',
        'text-halo-width': 1.5
      }
    });

    // 微观路网体系 (Apple Maps 风格：柔和石板灰细边 + 纯净暖白路心)
    map.addLayer({
      id: 'osm-minor-roads-casing',
      type: 'line',
      source: 'osm-vector-source',
      'source-layer': 'transportation',
      filter: ['match', ['get', 'class'], ['secondary', 'tertiary', 'minor', 'service', 'residential', 'unclassified'], true, false],
      paint: {
        'line-color': '#e0e4eb',
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.2, 11, 2.2, 14, 4.0],
        'line-opacity': 0.85
      }
    });

    map.addLayer({
      id: 'osm-minor-roads-core',
      type: 'line',
      source: 'osm-vector-source',
      'source-layer': 'transportation',
      filter: ['match', ['get', 'class'], ['secondary', 'tertiary', 'minor', 'service', 'residential', 'unclassified'], true, false],
      paint: {
        'line-color': '#ffffff',
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.7, 11, 1.5, 14, 3.0],
        'line-opacity': 0.95
      }
    });

    // 城市主要干道、国道与省道 (Apple Maps 风格：纯净暖白路心，彻底剔除晃眼刺目橙色)
    map.addLayer({
      id: 'osm-primary-roads-casing',
      type: 'line',
      source: 'osm-vector-source',
      'source-layer': 'transportation',
      filter: ['match', ['get', 'class'], ['trunk', 'primary'], true, false],
      paint: {
        'line-color': '#ccd2db',
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1.8, 10, 3.6, 14, 6.0],
        'line-opacity': 0.9
      }
    });

    map.addLayer({
      id: 'osm-primary-roads-core',
      type: 'line',
      source: 'osm-vector-source',
      'source-layer': 'transportation',
      filter: ['match', ['get', 'class'], ['trunk', 'primary'], true, false],
      paint: {
        'line-color': '#ffffff',
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1.0, 10, 2.4, 14, 4.5],
        'line-opacity': 1.0
      }
    });

    // 高速公路与城市快速高架路 (Apple Maps 经典柔和暖杏桃琥珀色，OLED 屏幕温和舒适，绝不刺眼)
    map.addLayer({
      id: 'osm-highway-casing',
      type: 'line',
      source: 'osm-vector-source',
      'source-layer': 'transportation',
      filter: ['match', ['get', 'class'], ['motorway'], true, false],
      paint: {
        'line-color': '#e29b55',
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 2.0, 10, 4.0, 14, 7.0],
        'line-opacity': 0.85
      }
    });

    map.addLayer({
      id: 'osm-highway-core',
      type: 'line',
      source: 'osm-vector-source',
      'source-layer': 'transportation',
      filter: ['match', ['get', 'class'], ['motorway'], true, false],
      paint: {
        'line-color': '#f5bd7a',
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1.2, 10, 2.6, 14, 5.0],
        'line-opacity': 1.0
      }
    });

    // 户外山野小径与步道 (Apple Maps 柔和暖陶土色虚线)
    map.addLayer({
      id: 'osm-trails-layer',
      type: 'line',
      source: 'osm-vector-source',
      'source-layer': 'transportation',
      filter: ['match', ['get', 'class'], ['path', 'track', 'footway', 'pedestrian', 'steps'], true, false],
      paint: {
        'line-color': '#d97736',
        'line-width': 2.0,
        'line-dasharray': [2, 1.5],
        'line-opacity': 0.85
      }
    });

    // 国道/省道/高速公路路名与标牌 (提前在 Zoom 5.5+ 显现，G318, G214 等清晰醒目)
    map.addLayer({
      id: 'osm-road-shields',
      type: 'symbol',
      source: 'osm-vector-source',
      'source-layer': 'transportation_name',
      filter: ['has', 'ref'],
      minzoom: 5.5,
      layout: {
        'symbol-placement': 'line',
        'text-field': ['get', 'ref'],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 5.5, 9.5, 9, 10.5, 12, 11.5],
        'symbol-spacing': 180,
        'text-max-angle': 60,
        'text-keep-upright': true
      },
      paint: {
        'text-color': '#b91c1c',
        'text-halo-color': '#ffffff',
        'text-halo-width': 3.5
      }
    });

    // 城市主干道路名称注记 (Zoom 9 起清晰显现)
    map.addLayer({
      id: 'osm-road-names',
      type: 'symbol',
      source: 'osm-vector-source',
      'source-layer': 'transportation_name',
      filter: ['all', ['has', 'name'], ['!has', 'ref']],
      minzoom: 9,
      layout: {
        'symbol-placement': 'line',
        'text-field': ['coalesce', ['get', 'name:zh'], ['get', 'name_zh'], ['get', 'name']],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 9, 9, 12, 10.5, 14, 11.5],
        'symbol-spacing': 250,
        'text-max-angle': 50,
        'text-keep-upright': true
      },
      paint: {
        'text-color': '#334155',
        'text-halo-color': '#ffffff',
        'text-halo-width': 2.5
      }
    });

    // 全国所有地级市与省会城市原生矢量注记 (覆盖全国，Zoom 4~12)
    // 全国所有地级市与省会城市原生矢量注记 (覆盖全国，Zoom 4~16)
    map.addLayer({
      id: 'osm-places-cities',
      type: 'symbol',
      source: 'osm-vector-source',
      'source-layer': 'place',
      filter: ['match', ['get', 'class'], ['city'], true, false],
      minzoom: 4,
      layout: {
        'text-field': ['coalesce', ['get', 'name:zh'], ['get', 'name_zh'], ['get', 'name']],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 4, 10, 7, 12, 10, 14, 14, 16],
        'text-anchor': 'center',
        'symbol-sort-key': ['coalesce', ['get', 'rank'], 1]
      },
      paint: {
        'text-color': '#0f172a',
        'text-halo-color': '#ffffff',
        'text-halo-width': 2.2
      }
    });

    // 乡镇、街道办事处 (覆盖全国所有乡镇及城市大型街道办，平滑延续至微观视口)
    map.addLayer({
      id: 'osm-places-towns',
      type: 'symbol',
      source: 'osm-vector-source',
      'source-layer': 'place',
      filter: ['match', ['get', 'class'], ['town', 'suburb'], true, false],
      minzoom: 5.5,
      layout: {
        'text-field': ['coalesce', ['get', 'name:zh'], ['get', 'name_zh'], ['get', 'name']],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 6, 9.5, 8, 11, 10, 12, 13, 13.5, 16, 15],
        'text-anchor': 'center',
        'text-padding': 3,
        'symbol-sort-key': ['coalesce', ['get', 'rank'], 5]
      },
      paint: {
        'text-color': '#1e293b',
        'text-halo-color': '#ffffff',
        'text-halo-width': 2.2
      }
    });

    // 村庄、自然村、庄、屯、居住社区与住宅小区 (无 emoji 纯正中文字符，100% 渲染全量村级地名与住宅小区)
    map.addLayer({
      id: 'osm-places-villages',
      type: 'symbol',
      source: 'osm-vector-source',
      'source-layer': 'place',
      filter: ['match', ['get', 'class'], ['village', 'hamlet', 'isolated_dwelling', 'neighbourhood', 'quarter', 'residential'], true, false],
      minzoom: 7.0,
      layout: {
        'text-field': ['coalesce', ['get', 'name:zh'], ['get', 'name_zh'], ['get', 'name']],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 7, 8.5, 8, 9.5, 10, 10.5, 12, 12, 14, 13.5, 16, 14.5],
        'text-anchor': 'center',
        'text-padding': 3,
        'symbol-sort-key': ['coalesce', ['get', 'rank'], 10]
      },
      paint: {
        'text-color': '#1e293b',
        'text-halo-color': '#ffffff',
        'text-halo-width': 2.5
      }
    });

    // 著名山峰与高峰 (标准自然地形注记，微观层级自然显现)
    map.addLayer({
      id: 'osm-mountain-peaks',
      type: 'symbol',
      source: 'osm-vector-source',
      'source-layer': 'mountain_peak',
      filter: ['has', 'name'],
      minzoom: 6.5,
      layout: {
        'text-field': [
          'case',
          ['has', 'ele'],
          ['concat', '▲ ', ['coalesce', ['get', 'name:zh'], ['get', 'name_zh'], ['get', 'name']], ', ', ['get', 'ele'], 'm'],
          ['concat', '▲ ', ['coalesce', ['get', 'name:zh'], ['get', 'name_zh'], ['get', 'name']]]
        ],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 6.5, 9.0, 9, 10.0, 12, 11.5, 15, 13.5],
        'text-anchor': 'bottom',
        'text-offset': [0, -0.2],
        'text-padding': 2
      },
      paint: {
        'text-color': '#15803d',
        'text-halo-color': '#ffffff',
        'text-halo-width': 2.4
      }
    });

    // 户外重点景点、观景台、露营地与历史名胜 (独立层级优先显示)
    map.addLayer({
      id: 'osm-outdoor-scenic-pois',
      type: 'symbol',
      source: 'osm-vector-source',
      'source-layer': 'poi',
      filter: ['match', ['get', 'class'], ['attraction', 'viewpoint', 'theme_park', 'monument', 'campsite', 'picnic_site', 'alpine_hut', 'shelter', 'castle'], true, false],
      minzoom: 8,
      layout: {
        'text-field': ['concat', '★ ', ['coalesce', ['get', 'name:zh'], ['get', 'name_zh'], ['get', 'name']]],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 8, 9.5, 11, 11, 14, 13],
        'text-anchor': 'bottom',
        'text-offset': [0, -0.3],
        'text-padding': 2,
        'symbol-sort-key': 8
      },
      paint: {
        'text-color': '#b45309',
        'text-halo-color': '#ffffff',
        'text-halo-width': 2.2
      }
    });

    // 全量 POI 实体物理位置小微圆点 (分类赋色，不遮挡地图，严格排除景点与无用道闸)
    map.addLayer({
      id: 'osm-all-pois-dots',
      type: 'circle',
      source: 'osm-vector-source',
      'source-layer': 'poi',
      filter: [
        'all',
        ['any', ['has', 'name'], ['has', 'name:zh'], ['has', 'name_zh']],
        ['!', ['match', ['get', 'class'], ['attraction', 'viewpoint', 'theme_park', 'monument', 'campsite', 'picnic_site', 'alpine_hut', 'shelter', 'castle', 'gate', 'lift_gate', 'bollard', 'waste_basket'], true, false]]
      ],
      minzoom: 11,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 2.0, 13, 2.8, 15, 3.5],
        'circle-color': [
          'match',
          ['get', 'class'],
          ['school', 'university', 'college', 'kindergarten', 'library'], '#7c3aed',
          ['hospital', 'clinic', 'pharmacy', 'doctors', 'dentist'], '#0284c7',
          ['shop', 'grocery', 'supermarket', 'mall', 'bank', 'atm', 'marketplace', 'clothing_store', 'bakery', 'alcohol_shop'], '#059669',
          ['bus', 'bus_stop', 'railway', 'railway_station', 'parking', 'fuel', 'ferry_terminal'], '#2563eb',
          ['restaurant', 'fast_food', 'cafe', 'bar', 'beer', 'ice_cream', 'lodging', 'hotel'], '#d97706',
          ['town_hall', 'office', 'police', 'post', 'fire_station'], '#475569',
          ['park', 'garden', 'pitch', 'stadium', 'theatre', 'museum', 'cinema', 'art_gallery', 'place_of_worship'], '#0f766e',
          '#64748b'
        ],
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1.5
      }
    });

    // 全量 POI 唯一单一注记层 (彻底杜绝多层重叠与双重文字，多类别精准着色，严格排除景点以防与scenic层重复)
    map.addLayer({
      id: 'osm-all-pois',
      type: 'symbol',
      source: 'osm-vector-source',
      'source-layer': 'poi',
      filter: [
        'all',
        ['any', ['has', 'name'], ['has', 'name:zh'], ['has', 'name_zh']],
        ['!', ['match', ['get', 'class'], ['attraction', 'viewpoint', 'theme_park', 'monument', 'campsite', 'picnic_site', 'alpine_hut', 'shelter', 'castle', 'gate', 'lift_gate', 'bollard', 'waste_basket'], true, false]]
      ],
      minzoom: 11,
      layout: {
        'text-field': ['coalesce', ['get', 'name:zh'], ['get', 'name_zh'], ['get', 'name']],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 11, 9.5, 13, 11, 15, 12.5],
        'text-anchor': 'top',
        'text-offset': [0, 0.6],
        'text-padding': 2,
        'symbol-sort-key': ['coalesce', ['get', 'rank'], 20]
      },
      paint: {
        'text-color': [
          'match',
          ['get', 'class'],
          ['school', 'university', 'college', 'kindergarten', 'library'], '#6d28d9',
          ['hospital', 'clinic', 'pharmacy', 'doctors', 'dentist'], '#0284c7',
          ['shop', 'grocery', 'supermarket', 'mall', 'bank', 'atm', 'marketplace', 'clothing_store', 'bakery', 'alcohol_shop'], '#059669',
          ['bus', 'bus_stop', 'railway', 'railway_station', 'parking', 'fuel', 'ferry_terminal'], '#2563eb',
          ['restaurant', 'fast_food', 'cafe', 'bar', 'beer', 'ice_cream', 'lodging', 'hotel'], '#d97706',
          ['town_hall', 'office', 'police', 'post', 'fire_station'], '#334155',
          ['park', 'garden', 'pitch', 'stadium', 'theatre', 'museum', 'cinema', 'art_gallery', 'place_of_worship'], '#0f766e',
          '#334155'
        ],
        'text-halo-color': '#ffffff',
        'text-halo-width': 2.2
      }
    });

    // 14. 自然保护区、城市公园绿地注记
    map.addLayer({
      id: 'osm-park-labels',
      type: 'symbol',
      source: 'osm-vector-source',
      'source-layer': 'park',
      filter: ['has', 'name'],
      minzoom: 8,
      layout: {
        'text-field': ['coalesce', ['get', 'name:zh'], ['get', 'name_zh'], ['get', 'name']],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 8, 10, 12, 12, 15, 14],
        'text-anchor': 'center',
        'text-padding': 2
      },
      paint: {
        'text-color': '#15803d',
        'text-halo-color': '#ffffff',
        'text-halo-width': 2.0
      }
    });

    // 15. 湖泊水库与水系地名
    map.addLayer({
      id: 'osm-water-names-poi',
      type: 'symbol',
      source: 'osm-vector-source',
      'source-layer': 'water_name',
      filter: ['has', 'name'],
      minzoom: 8,
      layout: {
        'text-field': ['coalesce', ['get', 'name:zh'], ['get', 'name_zh'], ['get', 'name']],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 8, 10, 12, 12, 15, 13],
        'text-anchor': 'center',
        'text-padding': 2
      },
      paint: {
        'text-color': '#0284c7',
        'text-halo-color': '#ffffff',
        'text-halo-width': 2.0
      }
    });

    // 16. 小区楼栋号与街道门牌号注记 (如 1号楼, 5号楼, 18号)
    map.addLayer({
      id: 'osm-housenumber-labels',
      type: 'symbol',
      source: 'osm-vector-source',
      'source-layer': 'housenumber',
      minzoom: 14,
      layout: {
        'text-field': ['get', 'housenumber'],
        'text-font': ['Noto Sans Regular'],
        'text-size': 9.5,
        'text-anchor': 'center'
      },
      paint: {
        'text-color': '#64748b',
        'text-halo-color': '#ffffff',
        'text-halo-width': 1.6
      }
    });

    // 17. 3D 建筑白模立体高度
    map.addLayer({
      id: 'osm-buildings-3d',
      type: 'fill-extrusion',
      source: 'osm-vector-source',
      'source-layer': 'building',
      minzoom: 13,
      paint: {
        'fill-extrusion-color': '#e2e8f0',
        'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 8],
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
        'fill-extrusion-opacity': 0.75
      }
    });

    // 18. 建筑名称标签 (如综合楼、A座等)
    map.addLayer({
      id: 'osm-building-labels',
      type: 'symbol',
      source: 'osm-vector-source',
      'source-layer': 'building',
      filter: ['has', 'name'],
      minzoom: 13.5,
      layout: {
        'text-field': ['coalesce', ['get', 'name:zh'], ['get', 'name_zh'], ['get', 'name']],
        'text-font': ['Noto Sans Regular'],
        'text-size': 10,
        'text-anchor': 'center',
        'text-padding': 2
      },
      paint: {
        'text-color': '#1e293b',
        'text-halo-color': '#ffffff',
        'text-halo-width': 2.0
      }
    });

    renderAllMapLabels(map);

    // 适配屏幕分辨率并确保三维地图精确居中
    map.resize();
    window.addEventListener('resize', () => map.resize());
  });

  setupOfficeHeaderInteractions(map);
  setupWaypointAndFavoritesSystem(map);
  setupOutdoorRouteSystem(map);
  setupMapContextMenu(map);
}

function renderAllMapLabels(map) {
  // 遵循自然标准地图渲染规范：所有省份行政区划、名山地貌与城镇注记均由底层矢量切片按缩放层级原生展现
  // 彻底移除覆盖在最上层的自定义人工省份与名山 DOM 浮动遮挡物，还原纯净地图界面
  [provinceMarkers, cityMarkers, mountainMarkers].forEach(arr => {
    arr.forEach(m => m.remove());
    arr.length = 0;
  });
}

// =========================================================
// 智能地理编码与地点候选中枢 (中国境内坐标/城市/名山/小区全域检索)
// =========================================================
let activeSearchAbort = null;

// 坐标解析器 (支持 "117.12, 36.45" / "36.45, 117.12" / "117.12 36.45")
function parseCoordinates(str) {
  const clean = str.replace(/[°NSEWnsew,]/g, ' ').trim();
  const parts = clean.split(/\s+/).map(Number).filter(n => !isNaN(n));
  if (parts.length >= 2) {
    let [a, b] = parts;
    let lng, lat;
    if (a >= 73 && a <= 136 && b >= 3 && b <= 54) {
      lng = a; lat = b;
    } else if (b >= 73 && b <= 136 && a >= 3 && a <= 54) {
      lng = b; lat = a;
    } else if (a >= -180 && a <= 180 && b >= -90 && b <= 90) {
      lng = a; lat = b;
    } else {
      return null;
    }
    return { coords: [lng, lat], title: `坐标 (${lng.toFixed(4)}°, ${lat.toFixed(4)}°)` };
  }
  return null;
}

// 极速拼音转汉字引擎 (支持纯网页 JSONP 与 Electron 零跨域并发查询，1.2s 超时防抖与平滑回退)
function pinyinToChineseWords(pinyin) {
  const py = (pinyin || '').trim().toLowerCase().replace(/\s+/g, '');
  if (!py || !/^[a-z]+$/.test(py)) {
    return Promise.resolve([]);
  }

  return new Promise((resolve) => {
    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        resolve([]);
      }
    }, 1200);

    const cbName = 'outmap_py_cb_' + Math.random().toString(36).slice(2, 9);

    function cleanup() {
      if (typeof window !== 'undefined' && window[cbName]) {
        delete window[cbName];
      }
      const el = typeof document !== 'undefined' ? document.getElementById(cbName) : null;
      if (el && el.parentNode) {
        el.parentNode.removeChild(el);
      }
    }

    if (typeof window === 'undefined') {
      clearTimeout(timer);
      resolve([]);
      return;
    }

    window[cbName] = function(data) {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        cleanup();
        if (data && Array.isArray(data.s)) {
          // 提取包含汉字的候选词，过滤无关词，保留前 5 个最匹配的候选词
          const words = data.s
            .filter(w => /[\u4e00-\u9fa5]/.test(w))
            .slice(0, 5);
          resolve(words);
        } else {
          resolve([]);
        }
      }
    };

    try {
      const script = document.createElement('script');
      script.id = cbName;
      script.src = `https://suggestion.baidu.com/su?wd=${encodeURIComponent(py)}&cb=${cbName}&ie=UTF-8`;
      script.onerror = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          cleanup();
          resolve([]);
        }
      };
      document.head.appendChild(script);
    } catch (e) {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve([]);
      }
    }
  });
}

// 综合检索引擎：支持任意 POI 全拼联想、本地海量地名字典与在线高精地理编码
async function queryLocationCandidates(keyword) {
  const raw = (keyword || '').trim();
  if (!raw) {
    return [];
  }
  const q = raw.toLowerCase();
  const cleanPy = q.replace(/\s+/g, '');
  const isPinyin = /^[a-z]+$/.test(cleanPy);

  const coordMatch = parseCoordinates(q);
  if (coordMatch) {
    return [{
      name: coordMatch.title,
      desc: 'GPS 经纬度绝对坐标',
      coords: [Number(coordMatch.coords[0]), Number(coordMatch.coords[1])],
      icon: '🎯',
      zoom: 15.0
    }];
  }

  // 若输入为全拼或含拼音字母，自动并发异步转换为中文候选词 (如 bailujinan -> ['白鹭金岸', '白鹭金岸天玺'])
  let chineseWords = [];
  if (isPinyin) {
    try {
      chineseWords = await pinyinToChineseWords(cleanPy);
    } catch (e) {}
  }

  const localMatches = [];
  const searchChineseTerms = [raw, ...chineseWords];

  // 1. 省份匹配 (名称 / 全拼 / 简拼 / 首字母缩写 / 转化候选词)
  if (typeof PROVINCES_DATA !== 'undefined') {
    Object.keys(PROVINCES_DATA).forEach(k => {
      const p = PROVINCES_DATA[k];
      const pinyin = (p.pinyin || '').toLowerCase();
      const py = (p.py || '').toLowerCase();
      const pGroup = (p.pinyinGroup || '').toLowerCase();
      const en = (p.en || '').toLowerCase();
      const matchPinyin = pinyin.startsWith(cleanPy) || pinyin.includes(cleanPy) || py === cleanPy || py.startsWith(cleanPy) || pGroup === cleanPy || en.includes(cleanPy);
      const matchName = searchChineseTerms.some(term => p.name.includes(term) || term.includes(p.name));

      if (matchName || matchPinyin) {
        let score = 3;
        if (p.name === raw || pinyin === cleanPy || py === cleanPy) score = 1;
        else if (pinyin.startsWith(cleanPy) || p.name.startsWith(raw) || py.startsWith(cleanPy)) score = 2;
        localMatches.push({
          name: p.name,
          desc: `省级行政区 · ${p.pinyin || p.en || ''}`,
          coords: [Number(p.center[0]), Number(p.center[1])],
          icon: '🚩',
          type: 'province',
          zoom: p.zoom,
          _score: score
        });
      }
    });
  }

  // 2. 名山匹配 (名称 / 全拼 / 简拼 / 转化候选词)
  if (typeof MOUNTAIN_POIS !== 'undefined') {
    MOUNTAIN_POIS.forEach(m => {
      const pinyin = (m.pinyin || '').toLowerCase();
      const py = (m.py || '').toLowerCase();
      const matchPinyin = pinyin.startsWith(cleanPy) || pinyin.includes(cleanPy) || py === cleanPy || py.startsWith(cleanPy);
      const matchName = searchChineseTerms.some(term => m.name.includes(term) || term.includes(m.name));

      if (matchName || matchPinyin) {
        let score = 3;
        if (m.name === raw || pinyin === cleanPy || py === cleanPy) score = 1;
        else if (pinyin.startsWith(cleanPy) || m.name.startsWith(raw)) score = 2;
        localMatches.push({
          name: m.name,
          desc: `著名山峰 · 海拔 ${m.ele}米`,
          coords: [Number(m.coords[0]), Number(m.coords[1])],
          icon: '🏔️',
          type: 'mountain',
          zoom: 13.8,
          _score: score
        });
      }
    });
  }

  // 3. 全国地级市与重点城镇全量匹配 (汉字 / 全拼 / 拼音首字母，如 linyi/ly -> 临沂市)
  if (typeof MAJOR_CITIES !== 'undefined') {
    MAJOR_CITIES.forEach(c => {
      const pinyin = (c.pinyin || '').toLowerCase();
      const py = (c.py || '').toLowerCase();
      const en = (c.en || '').toLowerCase();
      const matchPinyin = pinyin === cleanPy || pinyin.startsWith(cleanPy) || pinyin.includes(cleanPy) || py === cleanPy || py.startsWith(cleanPy) || en.startsWith(cleanPy);
      const matchName = searchChineseTerms.some(term => c.name.includes(term) || term.includes(c.name));

      if (matchName || matchPinyin) {
        let score = 4;
        if (c.name === raw || pinyin === cleanPy || py === cleanPy) score = 1;
        else if (pinyin.startsWith(cleanPy) || c.name.startsWith(raw)) score = 2;
        else if (py.startsWith(cleanPy)) score = 3;

        localMatches.push({
          name: c.name,
          desc: `${c.province || '重点城市'} · ${c.pinyin || c.en || ''}`,
          coords: [Number(c.coords[0]), Number(c.coords[1])],
          icon: '🏙️',
          type: 'city',
          zoom: 12.5,
          _score: score
        });
      }
    });
  }

  // 4. 用户收藏夹匹配
  if (typeof savedWaypoints !== 'undefined' && Array.isArray(savedWaypoints)) {
    savedWaypoints.forEach(wp => {
      if (wp && wp.name) {
        const wpLower = wp.name.toLowerCase();
        const matchName = searchChineseTerms.some(term => wp.name.includes(term) || wpLower.includes(term.toLowerCase()));
        if (matchName) {
          localMatches.push({
            name: wp.name,
            desc: `我的收藏点 · ${wp.ele || 0}m`,
            coords: [Number(wp.lng), Number(wp.lat)],
            icon: '⭐',
            type: 'waypoint',
            zoom: 14.5,
            _score: 1
          });
        }
      }
    });
  }

  // 按相关度评分排序
  localMatches.sort((a, b) => (a._score || 9) - (b._score || 9));

  // 5. 在线全量 OSM Photon 地理编码检索 (对纯拼音输入，并发使用解析出的中文候选词检索)
  try {
    const photonTerms = [];
    if (chineseWords.length > 0) {
      // 优先取前 2 个高质量候选词进行高精地理编码
      chineseWords.slice(0, 2).forEach(w => {
        if (!photonTerms.includes(w)) photonTerms.push(w);
      });
    }
    if (!photonTerms.includes(raw) && (!isPinyin || photonTerms.length === 0)) {
      photonTerms.push(raw);
    }

    const ctrl = new AbortController();
    const timeoutId = setTimeout(() => ctrl.abort(), 2200);

    await Promise.all(photonTerms.map(async (term) => {
      try {
        const onlineUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(term)}&bbox=73.5,18.0,135.1,53.6&limit=12`;
        const resp = await fetch(onlineUrl, {
          signal: ctrl.signal,
          headers: { 'User-Agent': 'Outmap/1.0' }
        });
        if (resp.ok) {
          const geojson = await resp.json();
          if (geojson && geojson.features) {
            geojson.features.forEach(f => {
              const p = f.properties;
              const coords = f.geometry.coordinates;
              if (!coords || coords.length < 2) return;

              const lng = Number(coords[0]);
              const lat = Number(coords[1]);
              if (isNaN(lng) || isNaN(lat)) return;

              const inChinaBbox = lng >= 73.0 && lng <= 136.0 && lat >= 18.0 && lat <= 54.0;
              const isCountryCn = !p.countrycode || p.countrycode.toUpperCase() === 'CN' || p.country === 'China' || p.country === '中国';
              if (!inChinaBbox || !isCountryCn) return;

              const name = p.name || p.street || p.city || term;
              const parts = [p.state, p.city, p.district, p.locality]
                .filter(Boolean)
                .filter(s => s !== 'China' && s !== '中国');
              const cleanDesc = parts.join(' · ') || (p.type ? `OSM ${p.type}` : '');
              const desc = cleanDesc.replace(/^中国\s*[·,\-–]\s*/, '').replace(/China\s*[·,\-–]\s*/i, '');

              let icon = '📍';
              let type = 'poi';
              const osmValue = (p.osm_value || '').toLowerCase();

              if (osmValue.includes('residential') || osmValue.includes('housing') || osmValue.includes('suburb') || osmValue.includes('quarter') || name.includes('小区') || name.includes('家园') || name.includes('花园') || name.includes('苑') || name.includes('公馆')) {
                icon = '🏘️';
                type = 'community';
              } else if (osmValue.includes('mountain') || osmValue.includes('peak')) {
                icon = '🏔️';
                type = 'mountain';
              } else if (osmValue.includes('school') || osmValue.includes('university') || osmValue.includes('college')) {
                icon = '🏫';
              } else if (osmValue.includes('hospital') || osmValue.includes('clinic')) {
                icon = '🏥';
              } else if (osmValue.includes('city') || osmValue.includes('town')) {
                icon = '🏙️';
              }

              const isDuplicate = localMatches.some(m => {
                const dist = Math.hypot(m.coords[0] - lng, m.coords[1] - lat);
                return (m.name === name && dist < 0.005) || dist < 0.0008;
              });

              if (!isDuplicate) {
                localMatches.push({
                  name,
                  desc,
                  coords: [lng, lat],
                  icon,
                  type,
                  zoom: 15.0
                });
              }
            });
          }
        }
      } catch (e) {}
    }));

    clearTimeout(timeoutId);
  } catch (e) {
    // 离线环境平滑回退
  }

  return localMatches.slice(0, 16);
}

if (typeof window !== 'undefined') {
  window.pinyinToChineseWords = pinyinToChineseWords;
  window.queryLocationCandidates = queryLocationCandidates;
}

function setupOfficeHeaderInteractions(map) {
  // 1. 视角倾角高度锁定 (放置于 3D、正北 按钮旁边，右键仅能水平360度旋转)
  const btnLockPitch = document.getElementById('btn-lock-pitch-toggle');
  const statusPitchLock = document.getElementById('status-pitch-lock');

  const updatePitchLockState = (locked, targetPitch = null) => {
    isPitchLocked = locked;
    try {
      localStorage.setItem('outmap_pitch_locked', locked ? '1' : '0');
    } catch (e) {}

    if (btnLockPitch) {
      btnLockPitch.classList.toggle('active', locked);
      btnLockPitch.title = locked ? '视角倾角已锁定（点击解锁倾角高度）' : '锁定视角倾角高度（锁定后右键仅水平旋转）';
      btnLockPitch.innerHTML = locked
        ? `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
             <rect x="3" y="11" width="18" height="11" rx="2" ry="2" fill="currentColor" opacity="0.25"></rect>
             <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
             <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
           </svg>`
        : `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
             <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
             <path d="M7 11V7a5 5 0 0 1 9.9-1"></path>
           </svg>`;
    }

    if (locked) {
      const currentPitch = targetPitch !== null ? targetPitch : Math.round(map.getPitch() || 50);
      try {
        localStorage.setItem('outmap_locked_pitch_val', String(currentPitch));
      } catch (e) {}
      map.setMinPitch(currentPitch);
      map.setMaxPitch(currentPitch);
      if (statusPitchLock) statusPitchLock.innerText = `[高度锁定 ${currentPitch}° · 右键仅水平旋转]`;
    } else {
      map.setMinPitch(0);
      map.setMaxPitch(85);
      if (statusPitchLock) statusPitchLock.innerText = '';
    }

    if (typeof window.triggerRealtimeCloudSync === 'function') {
      window.triggerRealtimeCloudSync('pitch_lock_changed');
    }
  };
  updatePitchLockFn = updatePitchLockState;

  // 默认启动全国总览 50° 3D 锁定视角 (出厂即默认锁定为 50°)
  const selectProv = document.getElementById('select-offline-province');
  if (selectProv) {
    selectProv.value = 'china';
  }

  map.setPitch(50);
  updatePitchLockState(true, 50);

  if (btnLockPitch) {
    btnLockPitch.addEventListener('click', () => {
      updatePitchLockState(!isPitchLocked);
    });
  }

  // 2. 3D / 2D 切换 (切到 3D 时：视角 50 度锁定)
  const btn3D = document.getElementById('btn-3d-toggle');
  if (btn3D) {
    btn3D.classList.add('active');
    btn3D.addEventListener('click', () => {
      is3DView = !is3DView;
      btn3D.classList.toggle('active', is3DView);
      btn3D.title = is3DView ? '3D 立体模式（点击切换为 2D）' : '2D 平面模式（点击切换为 3D）';
      btn3D.innerHTML = is3DView
        ? `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
             <path d="M12 3l9 4.5v9L12 21l-9-4.5v-9L12 3z"></path>
             <path d="M12 12l9-4.5"></path>
             <path d="M12 12v9"></path>
             <path d="M12 12L3 7.5"></path>
           </svg>`
        : `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
             <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
             <line x1="8" y1="2" x2="8" y2="18"></line>
             <line x1="16" y1="6" x2="16" y2="22"></line>
           </svg>`;
      if (is3DView) {
        // 2D 切到 3D 视图：视角 50 度锁定！
        map.setMinPitch(0);
        map.setMaxPitch(85);
        map.easeTo({ pitch: 50, duration: 800 });
        setTimeout(() => updatePitchLockState(true, 50), 820);
      } else {
        // 切到 2D 视图：解除锁定并平俯至 0 度
        if (isPitchLocked) {
          updatePitchLockState(false);
        }
        map.easeTo({ pitch: 0, duration: 800 });
      }
    });
  }

  // 校准正北
  const btnNorth = document.getElementById('btn-reset-north');
  if (btnNorth) {
    btnNorth.addEventListener('click', () => {
      map.easeTo({ bearing: 0, duration: 800 });
    });
  }

  // 高程夸大滑块与移动端大尺寸底部滑块抽屉联动
  const exSlider = document.getElementById('exaggeration-slider');
  const exVal = document.getElementById('exaggeration-val');
  const headerSliderGroup = document.getElementById('header-slider-group');
  const mobileEleSheet = document.getElementById('mobile-ele-sheet');
  const btnCloseMobileEle = document.getElementById('btn-close-mobile-ele');
  const mobileEleRange = document.getElementById('mobile-ele-range');
  const mobileEleValText = document.getElementById('mobile-ele-val-text');
  const mobilePresetBtns = document.querySelectorAll('.mobile-ele-preset-btn');

  const setExaggerationValue = (v) => {
    currentExaggeration = v;
    if (exVal) exVal.innerText = `${v.toFixed(1)}x`;
    if (exSlider) exSlider.value = v;
    if (mobileEleRange) mobileEleRange.value = v;
    if (mobileEleValText) mobileEleValText.innerText = `${v.toFixed(1)}x`;
    map.setTerrain({ source: 'terrain-dem', exaggeration: v });
    mobilePresetBtns.forEach(btn => {
      btn.classList.toggle('active', Math.abs(parseFloat(btn.dataset.val) - v) < 0.05);
    });
  };

  if (exSlider) {
    exSlider.addEventListener('input', e => {
      setExaggerationValue(parseFloat(e.target.value));
    });
  }

  // 手机端点击高程胶囊唤起大滑块抽屉 (支持 click 与 touchend，防止移动端手势被吞)
  const toggleMobileElevationSheet = (e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const sheet = document.getElementById('mobile-ele-sheet');
    if (!sheet) return;
    const isHidden = sheet.style.display === 'none' || !sheet.classList.contains('active');
    if (isHidden) {
      sheet.style.display = 'flex';
      sheet.classList.add('active');
      setExaggerationValue(currentExaggeration);
    } else {
      sheet.style.display = 'none';
      sheet.classList.remove('active');
    }
  };

  const sliderGroupEl = document.getElementById('header-slider-group') || document.querySelector('.office-slider-group');
  if (sliderGroupEl) {
    sliderGroupEl.addEventListener('click', (e) => {
      if (window.innerWidth <= 768) {
        toggleMobileElevationSheet(e);
      }
    });
    sliderGroupEl.addEventListener('touchend', (e) => {
      if (window.innerWidth <= 768) {
        toggleMobileElevationSheet(e);
      }
    });
  }

  mobileEleSheet?.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  mobileEleRange?.addEventListener('input', e => {
    setExaggerationValue(parseFloat(e.target.value));
  });

  mobilePresetBtns.forEach(btn => {
    const handlePreset = (e) => {
      e.stopPropagation();
      e.preventDefault();
      setExaggerationValue(parseFloat(btn.dataset.val));
    };
    btn.addEventListener('click', handlePreset);
    btn.addEventListener('touchend', handlePreset);
  });

  const handleCloseMobileEle = (e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (mobileEleSheet) {
      mobileEleSheet.style.display = 'none';
      mobileEleSheet.classList.remove('active');
    }
  };
  btnCloseMobileEle?.addEventListener('click', handleCloseMobileEle);
  btnCloseMobileEle?.addEventListener('touchend', handleCloseMobileEle);

  // 点击地图或空白区域自动收起已展开的底部抽屉与弹窗 (改善手机端易点空白收起的体验)
  map.on('click', () => {
    if (pickingRoutePt || isContinuousPicking) return;
    const toClose = [
      document.getElementById('route-panel'),
      document.getElementById('favorites-drawer'),
      document.getElementById('mobile-ele-sheet'),
      document.getElementById('waypoint-modal'),
      document.getElementById('save-route-modal'),
      document.getElementById('map-context-menu'),
      document.getElementById('prov-popover-menu'),
      document.getElementById('search-popover')
    ];
    toClose.forEach(el => {
      if (el && el.style.display !== 'none') {
        el.style.display = 'none';
        el.classList.remove('active');
      }
    });
    const provTriggerBtn = document.getElementById('btn-prov-dropdown-trigger');
    if (provTriggerBtn) provTriggerBtn.classList.remove('active');
  });

  // 3. 点击展开的全局搜索交互系统 (中国境内严格过滤、搜索历史持久化、支持经纬度/小区/名山/城市全量POI检索与回车直达)
  const searchTrigger = document.getElementById('btn-search-trigger');
  const searchPopover = document.getElementById('search-popover');
  const searchClose = document.getElementById('btn-close-search');
  const sInput = document.getElementById('global-search-input');
  const resultsContainer = document.getElementById('search-results-list');

  let currentSearchResults = [];
  let searchDebounceTimer = null;
  let currentLandingMarker = null;

  function getSearchHistory() {
    try {
      return JSON.parse(localStorage.getItem('outmap_search_history') || '[]');
    } catch (e) {
      return [];
    }
  }

  function saveSearchHistoryItem(item) {
    if (!item || !item.name) return;
    let history = getSearchHistory().filter(h => h.name !== item.name);
    history.unshift({
      name: item.name,
      desc: item.desc || '',
      coords: item.coords,
      icon: item.icon || '📍',
      type: item.type || 'poi',
      zoom: item.zoom || 14
    });
    if (history.length > 10) history = history.slice(0, 10);
    try {
      localStorage.setItem('outmap_search_history', JSON.stringify(history));
    } catch (e) {}
  }

  function clearSearchHistory() {
    try {
      localStorage.removeItem('outmap_search_history');
    } catch (e) {}
    renderSearchHistory();
  }

  function stripChinaPrefix(str) {
    if (!str) return '';
    return String(str)
      .replace(/^中国\s*[·,\-–\s]\s*/, '')
      .replace(/China\s*[·,\-–\s]\s*/i, '')
      .replace(/\b中国\s*[·,\-–\s]\s*/g, '')
      .trim();
  }

  function renderSearchHistory() {
    const history = getSearchHistory();
    if (!resultsContainer) return;

    if (!history || history.length === 0) {
      resultsContainer.innerHTML = '<div class="search-empty-tip">暂无历史记录，输入城市、小区或地名后回车即可直达</div>';
      resultsContainer.style.display = 'block';
      return;
    }

    resultsContainer.innerHTML = `
      <div class="search-history-header">
        <span class="search-history-title">⏱️ 搜索历史</span>
        <button class="btn-clear-history" id="btn-clear-history-action">清空历史</button>
      </div>
    `;

    const clearBtn = resultsContainer.querySelector('#btn-clear-history-action');
    clearBtn?.addEventListener('click', e => {
      e.stopPropagation();
      clearSearchHistory();
    });

    history.forEach(item => {
      const row = document.createElement('div');
      row.className = 'search-result-item';
      const cleanDesc = stripChinaPrefix(item.desc || '历史搜索地点');
      row.innerHTML = `
        <div class="search-result-icon">${item.icon || '⏱️'}</div>
        <div class="search-result-info">
          <div class="search-result-name">${item.name}</div>
          <div class="search-result-desc">${cleanDesc}</div>
        </div>
      `;
      row.addEventListener('click', () => {
        executeJumpToResult(item);
      });
      resultsContainer.appendChild(row);
    });

    resultsContainer.style.display = 'block';
  }

  /**
   * 精确计算地标在特定视口比例（默认屏幕高度 67%，即居中偏下三分之一）时的摄像机中心经纬度
   * 采用三维针孔摄像机透视投影与地面反向求交方程，彻底根除 MapLibre 原生 flyTo 传入 offset 时
   * 在大跨层级缩放（如 4.5 到 15）及 3D 俯仰视角下所产生的非线性插值畸变、跑偏与甩出屏幕问题。
   */
  function calculateOffsetCameraCenter(mapInstance, targetCoords, targetZoom = 15.0, targetPitch = 50, screenRatioY = 0.67) {
    if (!targetCoords || targetCoords.length < 2) return targetCoords;
    const lng = Number(targetCoords[0]);
    const lat = Number(targetCoords[1]);
    if (isNaN(lng) || isNaN(lat)) return targetCoords;

    const m = mapInstance || map;
    const container = m ? (m.getContainer ? m.getContainer() : null) : null;
    const height = container ? (container.clientHeight || window.innerHeight || 660) : (window.innerHeight || 660);

    // 1. 水平方向严格绝对居中，经度保持一致
    const centerLng = lng;

    // 2. 垂直方向基于 MapLibre 3D 针孔相机几何解算地面 Mercator 像素偏移
    const dy = height * (screenRatioY - 0.5);
    const pitchRad = (targetPitch || 0) * Math.PI / 180;
    const fovRad = 36.87 * Math.PI / 180; // MapLibre 默认固定垂直视野角
    const d0 = 0.5 / Math.tan(fovRad / 2) * height;

    const camY = -d0 * Math.sin(pitchRad);
    const camZ = d0 * Math.cos(pitchRad);
    const rayY = d0 * Math.sin(pitchRad) + dy * Math.cos(pitchRad);
    const rayZ = -d0 * Math.cos(pitchRad) + dy * Math.sin(pitchRad);

    if (Math.abs(rayZ) < 1e-6) {
      return [centerLng, lat];
    }

    const t = -camZ / rayZ;
    const groundY = camY + t * rayY; // 在目标 zoom 级别下的 Web Mercator 像素位移

    const worldSize = 512 * Math.pow(2, targetZoom);
    const latRad = lat * Math.PI / 180;
    const mercY = (0.5 - Math.log(Math.tan(Math.PI / 4 + latRad / 2)) / (2 * Math.PI)) * worldSize;
    const camMercY = mercY - groundY;

    const yNorm = 0.5 - camMercY / worldSize;
    const safeYNorm = Math.max(0.001, Math.min(0.999, yNorm));
    const centerLatRad = 2 * Math.atan(Math.exp(safeYNorm * 2 * Math.PI)) - Math.PI / 2;
    const centerLat = centerLatRad * 180 / Math.PI;

    return [centerLng, centerLat];
  }

  function showLandingMarker(coords, title, desc = '') {
    if (!coords || coords.length < 2) return;
    const lng = Number(coords[0]);
    const lat = Number(coords[1]);
    if (isNaN(lng) || isNaN(lat)) return;
    const validCoords = [lng, lat];

    if (currentLandingMarker) {
      currentLandingMarker.remove();
      currentLandingMarker = null;
    }

    const ele = Math.round(getRealElevation(map, { lng: validCoords[0], lat: validCoords[1] }) || 0);
    const cleanDesc = stripChinaPrefix(desc || '');
    const metaText = cleanDesc || `${validCoords[0].toFixed(4)}°E, ${validCoords[1].toFixed(4)}°N · ${ele}m`;

    const el = document.createElement('div');
    el.className = 'landing-pulse-marker';
    el.innerHTML = `
      <div class="landing-card">
        <div class="landing-card-header">
          <div class="landing-card-title" title="${escapeHtml(title)}">${escapeHtml(title)}</div>
          <button class="landing-card-close" title="关闭标记">✕</button>
        </div>
        <div class="landing-card-desc" title="${escapeHtml(metaText)}">${escapeHtml(metaText)}</div>
        <div class="landing-card-actions">
          <button class="landing-act-btn primary act-fav" title="添加到收藏夹">⭐ 收藏</button>
          <button class="landing-act-btn act-start" title="设为路线起点">🚩 起点</button>
          <button class="landing-act-btn act-via" title="添加为路线途径点">➕ 途径</button>
          <button class="landing-act-btn act-end" title="设为路线终点">🏁 终点</button>
        </div>
      </div>
      <div class="pulse-pin-wrap" title="右键可打开完整菜单，点击定位">
        <div class="pulse-ring"></div>
        <div class="pulse-core">📍</div>
      </div>
    `;

    // 关闭标记
    const btnClose = el.querySelector('.landing-card-close');
    if (btnClose) {
      btnClose.addEventListener('click', (e) => {
        e.stopPropagation();
        if (currentLandingMarker) {
          currentLandingMarker.remove();
          currentLandingMarker = null;
        }
      });
    }

    // 快捷按钮：收藏
    const btnFav = el.querySelector('.act-fav');
    if (btnFav) {
      btnFav.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof window.openWaypointModalForLocation === 'function') {
          window.openWaypointModalForLocation(validCoords, title);
        }
      });
    }

    // 快捷按钮：起点
    const btnStart = el.querySelector('.act-start');
    if (btnStart) {
      btnStart.addEventListener('click', (e) => {
        e.stopPropagation();
        setRouteStartPoint(map, validCoords, title);
      });
    }

    // 快捷按钮：途径点
    const btnVia = el.querySelector('.act-via');
    if (btnVia) {
      btnVia.addEventListener('click', (e) => {
        e.stopPropagation();
        addViaPoint(map, validCoords, title);
      });
    }

    // 快捷按钮：终点
    const btnEnd = el.querySelector('.act-end');
    if (btnEnd) {
      btnEnd.addEventListener('click', (e) => {
        e.stopPropagation();
        setRouteEndPoint(map, validCoords, title);
      });
    }

    // 点击图钉重新飞到此处完美偏下居中 (zoom 15, offset: [0, 0])
    const pinWrap = el.querySelector('.pulse-pin-wrap');
    if (pinWrap) {
      pinWrap.addEventListener('click', (e) => {
        e.stopPropagation();
        const curPitch = map.getPitch() || 50;
        const cameraCenter = calculateOffsetCameraCenter(map, validCoords, 15.0, curPitch, 0.67);
        map.flyTo({ center: cameraCenter, zoom: 15.0, pitch: curPitch, offset: [0, 0], duration: 800, essential: true });
      });
    }

    // 右键支持：在标记/卡片上右键唤起上下文菜单，地名严格采用搜索出的精准名称
    const triggerContextMenu = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (typeof window.showContextMenuForLocation === 'function') {
        const wrap = document.getElementById('map-wrap') || map.getContainer();
        const wrapRect = wrap.getBoundingClientRect();
        const point = {
          x: e.clientX - wrapRect.left,
          y: e.clientY - wrapRect.top
        };
        window.showContextMenuForLocation({ lng: validCoords[0], lat: validCoords[1] }, point, title);
      }
    };

    el.addEventListener('contextmenu', triggerContextMenu);

    // 阻止拖拽地图穿透
    el.addEventListener('mousedown', (e) => e.stopPropagation());
    el.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });

    currentLandingMarker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
      .setLngLat(validCoords)
      .addTo(map);
  }

  function renderSearchResults(items) {
    currentSearchResults = items;
    if (!resultsContainer) return;

    if (!items || items.length === 0) {
      resultsContainer.innerHTML = '<div class="search-empty-tip">未找到匹配地点，支持直接输入经纬度或更具体的小区/地标名</div>';
      resultsContainer.style.display = 'block';
      return;
    }

    resultsContainer.innerHTML = '';
    items.forEach(item => {
      const row = document.createElement('div');
      row.className = 'search-result-item';
      const cleanDesc = stripChinaPrefix(item.desc || '');
      row.innerHTML = `
        <div class="search-result-icon">${item.icon || '📍'}</div>
        <div class="search-result-info">
          <div class="search-result-name">${item.name}</div>
          <div class="search-result-desc">${cleanDesc}</div>
        </div>
      `;

      row.addEventListener('click', () => {
        executeJumpToResult(item);
      });

      resultsContainer.appendChild(row);
    });

    resultsContainer.style.display = 'block';
  }

  function executeJumpToResult(item) {
    if (!item || !item.coords || item.coords.length < 2) return;
    const lng = Number(item.coords[0]);
    const lat = Number(item.coords[1]);
    if (isNaN(lng) || isNaN(lat)) return;
    const validCoords = [lng, lat];

    if (searchPopover) searchPopover.style.display = 'none';
    if (resultsContainer) resultsContainer.style.display = 'none';
    if (sInput) sInput.value = item.name;

    saveSearchHistoryItem(item);

    // 若搜索结果是省份，同步顶栏省份标签
    Object.keys(PROVINCES_DATA).forEach(k => {
      if (PROVINCES_DATA[k].name === item.name) {
        updateProvDropdownLabel(k);
      }
    });

    const isProv = item.type === 'province';
    const targetZoom = isProv ? (item.zoom || 7.2) : 15.0;
    const currentZoom = map.getZoom();
    const minFlightZoom = Math.max(7.0, Math.min(currentZoom, targetZoom) - 2.0);
    const targetPitch = isPitchLocked ? map.getPitch() : Math.min(map.getPitch() || 50, 52);

    // 省份全境直接正中居中，具体地点/POI应用透视光线求交居中偏下 (比例 0.67)，完全杜绝跑偏与飞出屏幕
    const cameraCenter = isProv
      ? validCoords
      : calculateOffsetCameraCenter(map, validCoords, targetZoom, targetPitch, 0.67);

    map.flyTo({
      center: cameraCenter,
      zoom: targetZoom,
      pitch: targetPitch,
      offset: [0, 0], // 永远使用严格 [0, 0]，彻底避免 MapLibre 内部 offset 插值 bug 导致甩出屏幕
      curve: 1.1,
      minZoom: minFlightZoom,
      duration: 1200,
      essential: true
    });

    showLandingMarker(validCoords, item.name, item.desc);
  }

  // 搜索输入交互 (输入文字实时防抖检索；清空或聚焦时展示搜索历史)
  if (sInput) {
    sInput.addEventListener('input', () => {
      const val = sInput.value.trim();
      clearTimeout(searchDebounceTimer);
      if (!val) {
        renderSearchHistory();
        return;
      }

      searchDebounceTimer = setTimeout(async () => {
        const results = await queryLocationCandidates(val);
        renderSearchResults(results);
      }, 240);
    });

    sInput.addEventListener('focus', () => {
      if (!sInput.value.trim()) {
        renderSearchHistory();
      }
    });

    sInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        doSearch();
      }
    });
  }

  // 执行回车直达定位
  const doSearch = async () => {
    const text = (sInput.value || '').trim();
    if (!text) {
      sInput?.focus();
      return;
    }

    // 1. 若当前列表已有匹配项，直接飞往第一项
    if (currentSearchResults && currentSearchResults.length > 0) {
      executeJumpToResult(currentSearchResults[0]);
      return;
    }

    // 2. 实时现场检索匹配并直达
    const results = await queryLocationCandidates(text);
    if (results && results.length > 0) {
      executeJumpToResult(results[0]);
    } else {
      if (resultsContainer) {
        resultsContainer.innerHTML = `<div class="search-empty-tip">未检索到“${text}”，请检查地名拼写或直接输入经纬度坐标</div>`;
        resultsContainer.style.display = 'block';
      }
    }
  };

  const closeSearchPopover = () => {
    if (searchPopover && searchPopover.style.display !== 'none') {
      searchPopover.style.display = 'none';
      if (sInput) sInput.blur();
    }
  };

  if (searchTrigger && searchPopover) {
    searchTrigger.addEventListener('click', e => {
      e.stopPropagation();
      const isHidden = searchPopover.style.display === 'none';
      if (isHidden) {
        const provPopover = document.getElementById('prov-popover-menu');
        if (provPopover) provPopover.style.display = 'none';
        const provTriggerBtn = document.getElementById('btn-prov-dropdown-trigger');
        if (provTriggerBtn) provTriggerBtn.classList.remove('active');
      }
      searchPopover.style.display = isHidden ? 'block' : 'none';
      if (isHidden && sInput) {
        sInput.focus();
        sInput.select();
        if (sInput.value.trim()) {
          queryLocationCandidates(sInput.value.trim()).then(renderSearchResults);
        } else {
          renderSearchHistory();
        }
      }
    });

    const handleCloseSearch = (e) => {
      if (e) {
        e.stopPropagation();
        e.preventDefault();
      }
      closeSearchPopover();
    };
    searchClose?.addEventListener('click', handleCloseSearch);
    searchClose?.addEventListener('touchend', handleCloseSearch);

    document.addEventListener('click', e => {
      if (!searchPopover.contains(e.target) && e.target !== searchTrigger && !searchTrigger.contains(e.target)) {
        closeSearchPopover();
      }
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeSearchPopover();
    });

    // 点击/拖拽地图主界面时，立即关闭搜索框
    map.on('mousedown', closeSearchPopover);
    map.on('click', closeSearchPopover);
    map.on('dragstart', closeSearchPopover);
    map.on('touchstart', closeSearchPopover);

    const mapWrapEl = document.getElementById('map-wrap') || document.getElementById('map');
    if (mapWrapEl) {
      ['mousedown', 'pointerdown', 'touchstart', 'click'].forEach(evtName => {
        mapWrapEl.addEventListener(evtName, (e) => {
          if (!searchPopover.contains(e.target) && !searchTrigger.contains(e.target)) {
            closeSearchPopover();
          }
        }, { capture: true, passive: true });
      });
    }
  }

  // 快捷键 Ctrl+K / Cmd+K 快速呼出搜索
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (searchPopover) {
        searchPopover.style.display = 'block';
        if (sInput) {
          sInput.focus();
          sInput.select();
          if (!sInput.value.trim()) {
            renderSearchHistory();
          }
        }
      }
    }
  });

  // 4. 全国总览与 A-Z 拼音分组省份展开导航面板系统
  setupProvinceDropdown(map);

  // 5. 瓦片金字塔多级离线下载器模态框交互
  setupPyramidModal(map);

  // 6. 版本更新检测与一键热升级交互 (静默检查，新版弹窗)
  setupAppUpdate();

  // 7. 多设备云端漫游同步系统 (基于 Cloudflare R2，右键 Logo 呼出)
  setupCloudSync(map);

  // 8. 全局统一键盘快捷键与 ESC 键层级防穿透调度
  setupGlobalKeyboardDispatcher();

  setupStatusBar(map);
}

// 本地已下载离线省份包持久化记录 (双重持久化：优先同步磁盘 manifest.json，兼容 localStorage)
let offlineProvCache = null;

async function syncOfflineManifest() {
  if (window.electronAPI && window.electronAPI.getOfflineManifest) {
    try {
      const manifest = await window.electronAPI.getOfflineManifest();
      if (manifest && manifest.provinces) {
        offlineProvCache = manifest.provinces;
        try { localStorage.setItem('outmap_offline_provinces', JSON.stringify(offlineProvCache)); } catch (e) {}
        return offlineProvCache;
      }
    } catch (e) {}
  }
  return getOfflineProvState();
}

function getOfflineProvState() {
  if (offlineProvCache) return offlineProvCache;
  try {
    offlineProvCache = JSON.parse(localStorage.getItem('outmap_offline_provinces') || '{}');
    return offlineProvCache;
  } catch (e) {
    return {};
  }
}

function saveOfflineProvState(key, maxZ, details = {}) {
  const state = getOfflineProvState();
  const prev = state[key] || {};
  state[key] = {
    ...prev,
    ...details,
    maxZ: Math.max(prev.maxZ || 0, maxZ),
    updatedAt: Date.now()
  };
  offlineProvCache = state;
  try {
    localStorage.setItem('outmap_offline_provinces', JSON.stringify(state));
  } catch (e) {}

  if (window.electronAPI && window.electronAPI.saveOfflineManifest) {
    window.electronAPI.saveOfflineManifest({ provinces: state }).catch(() => {});
  }
}

let currentSelectedProvKey = 'china';

function updateProvDropdownLabel(key) {
  currentSelectedProvKey = key;
  const prov = PROVINCES_DATA[key];
  const provLabel = document.getElementById('current-prov-label');
  if (prov && provLabel) {
    provLabel.innerText = prov.name;
  }
  // 更新悬浮面板中高亮选中状态
  document.querySelectorAll('.prov-item-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.key === key);
  });
}

// 初始化 Fluent 全国总览与 A-Z 拼音分组省份导航面板
function setupProvinceDropdown(map) {
  const provTriggerBtn = document.getElementById('btn-prov-dropdown-trigger');
  const provPopover = document.getElementById('prov-popover-menu');
  const provQuickIdx = document.getElementById('prov-quick-index');
  const provMenuList = document.getElementById('prov-menu-list');

  if (!provTriggerBtn || !provPopover || !provMenuList) return;

  // 提取有效首字母分组并按字母升序排序
  const groups = {};
  Object.keys(PROVINCES_DATA).forEach(k => {
    if (k === 'china') return;
    const p = PROVINCES_DATA[k];
    const g = p.pinyinGroup || '其他';
    if (!groups[g]) groups[g] = [];
    groups[g].push({ key: k, ...p });
  });

  const sortedLetters = Object.keys(groups).sort();

  // 渲染 A-Z 快捷定位索引胶囊
  if (provQuickIdx) {
    provQuickIdx.innerHTML = '';
    sortedLetters.forEach(letter => {
      const btn = document.createElement('button');
      btn.className = 'prov-quick-idx-btn';
      btn.innerText = letter;
      btn.title = `快速跳转至 [${letter}] 开头的省份`;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const targetSec = provMenuList.querySelector(`#prov-sec-${letter}`);
        if (targetSec) {
          targetSec.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });
      provQuickIdx.appendChild(btn);
    });
  }

  // 渲染全国总览置顶项与拼音分组
  const renderListContent = () => {
    provMenuList.innerHTML = '';

    // 1. 置顶“全国总览”大胶囊
    const allChinaBtn = document.createElement('div');
    allChinaBtn.className = 'prov-all-china-btn';
    allChinaBtn.innerHTML = `
      <span class="p-name">🇨🇳 全国总览</span>
      <span class="p-tag">45° 3D 视角</span>
    `;
    allChinaBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      updateProvDropdownLabel('china');
      provPopover.style.display = 'none';
      provTriggerBtn.classList.remove('active');
      flyToProvince(map, 'china');
    });
    provMenuList.appendChild(allChinaBtn);

    // 2. 字母分组与省份网格
    const offlineState = getOfflineProvState();

    sortedLetters.forEach(letter => {
      const sec = document.createElement('div');
      sec.className = 'prov-group-section';
      sec.id = `prov-sec-${letter}`;

      const header = document.createElement('div');
      header.className = 'prov-group-header';
      header.innerText = `[${letter}]`;
      sec.appendChild(header);

      const grid = document.createElement('div');
      grid.className = 'prov-group-grid';

      groups[letter].forEach(p => {
        const pBtn = document.createElement('button');
        pBtn.className = 'prov-item-btn';
        pBtn.dataset.key = p.key;
        if (p.key === currentSelectedProvKey) pBtn.classList.add('selected');

        const isOffline = offlineState[p.key] && offlineState[p.key].maxZ >= 10;

        pBtn.innerHTML = `
          <span class="prov-name-txt">${p.name}</span>
          ${isOffline ? '<span class="prov-offline-dot" title="离线数据包已就绪"></span>' : ''}
        `;

        pBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          updateProvDropdownLabel(p.key);
          provPopover.style.display = 'none';
          provTriggerBtn.classList.remove('active');
          flyToProvince(map, p.key);
        });

        grid.appendChild(pBtn);
      });

      sec.appendChild(grid);
      provMenuList.appendChild(sec);
    });
  };

  renderListContent();

  // 点击触发按钮展开/收起
  provTriggerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isHidden = provPopover.style.display === 'none';
    if (isHidden) {
      const searchPopover = document.getElementById('search-popover');
      if (searchPopover) searchPopover.style.display = 'none';
      renderListContent(); // 重新检查是否有新下载完成的省份并刷新勾选
    }
    provPopover.style.display = isHidden ? 'flex' : 'none';
    provTriggerBtn.classList.toggle('active', isHidden);
  });

  // 关闭按钮点击收起
  const btnCloseProv = document.getElementById('btn-close-prov-menu');
  const handleCloseProv = (e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    provPopover.style.display = 'none';
    provTriggerBtn.classList.remove('active');
  };
  btnCloseProv?.addEventListener('click', handleCloseProv);
  btnCloseProv?.addEventListener('touchend', handleCloseProv);

  // 点击空白处收起
  document.addEventListener('click', (e) => {
    if (!provPopover.contains(e.target) && !provTriggerBtn.contains(e.target)) {
      provPopover.style.display = 'none';
      provTriggerBtn.classList.remove('active');
    }
  });

  map.on('mousedown', () => {
    provPopover.style.display = 'none';
    provTriggerBtn.classList.remove('active');
  });
  map.on('click', () => {
    provPopover.style.display = 'none';
    provTriggerBtn.classList.remove('active');
  });
  map.on('dragstart', () => {
    provPopover.style.display = 'none';
    provTriggerBtn.classList.remove('active');
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      provPopover.style.display = 'none';
      provTriggerBtn.classList.remove('active');
    }
  });
}

// 瓦片金字塔多级下载器系统 (支持多省批量勾选、层级卡片、双行紧凑统计与落盘校对)
function setupPyramidModal(map) {
  const modal = document.getElementById('pyramid-modal');
  const btnOpen = document.getElementById('btn-open-pyramid-dl');
  const btnClose = document.getElementById('btn-close-pyramid-modal');
  const multiGrid = document.getElementById('pyramid-prov-multi-grid');
  const btnSelectAll = document.getElementById('btn-prov-select-all');
  const btnSelectInvert = document.getElementById('btn-prov-select-invert');
  const btnSelectNone = document.getElementById('btn-prov-select-none');
  const counterBadge = document.getElementById('prov-selected-counter');
  const dropdownTrigger = document.getElementById('pyramid-prov-dropdown-trigger');
  const dropdownPanel = document.getElementById('pyramid-prov-dropdown-panel');
  const dropdownSummary = document.getElementById('prov-selected-names-summary');
  const zoomPills = document.querySelectorAll('#pyramid-zoom-pills .zoom-pill');
  const zoomInput = document.getElementById('pyramid-zoom-select');
  const chkDem = document.getElementById('chk-dl-dem');
  const chkVec = document.getElementById('chk-dl-vec');
  const statCount = document.getElementById('stat-tile-count');
  const statSize = document.getElementById('stat-tile-size');
  const provStatusTag = document.getElementById('prov-offline-status-tag');
  const btnStart = document.getElementById('btn-start-dl');
  const btnCancel = document.getElementById('btn-cancel-dl');
  const btnRetry = document.getElementById('btn-retry-dl');
  const btnDone = document.getElementById('btn-done-dl');
  const progressBox = document.getElementById('dl-progress-box');
  const progressFill = document.getElementById('dl-progress-fill');
  const progressNum = document.getElementById('dl-progress-num');
  const progressSpeed = document.getElementById('dl-progress-speed');
  const progressPct = document.getElementById('dl-progress-pct');

  if (!modal || !btnOpen) return;

  const dlBlueDot = document.getElementById('dl-live-blue-dot');
  let downloadDotState = 'idle'; // 'idle' (无标注) | 'downloading' (正在下载，蓝点) | 'completed' (下载完成，绿点)

  const updateBtnTooltip = () => {
    const isExpanded = btnOpen.classList.contains('expanded');
    if (downloadDotState === 'downloading') {
      btnOpen.title = isExpanded
        ? '离线地图下载 (后台正在下载... 点击收起)'
        : '离线地图下载 (后台正在下载... 点击展开)';
    } else if (downloadDotState === 'completed') {
      btnOpen.title = isExpanded
        ? '离线地图下载 (全部已就绪 · 点击收起)'
        : '离线地图下载 (全部已就绪 · 点击展开查看)';
    } else {
      btnOpen.title = isExpanded
        ? '离线地图下载 (点击收起)'
        : '离线地图下载 (点击展开)';
    }
  };

  const setDownloadDotState = (state) => {
    downloadDotState = state;
    if (!dlBlueDot) return;
    if (state === 'downloading') {
      dlBlueDot.style.display = 'block';
      dlBlueDot.classList.remove('completed');
      dlBlueDot.title = '后台正在下载离线瓦片...';
    } else if (state === 'completed') {
      dlBlueDot.style.display = 'block';
      dlBlueDot.classList.add('completed');
      dlBlueDot.title = '离线瓦片已全部下载完成';
    } else {
      dlBlueDot.style.display = 'none';
      dlBlueDot.classList.remove('completed');
    }
    updateBtnTooltip();
  };

  const toggleDropdown = (show) => {
    if (!dropdownPanel) return;
    const isCurrentlyOpen = dropdownPanel.style.display === 'block';
    const nextState = (typeof show === 'boolean') ? show : !isCurrentlyOpen;
    dropdownPanel.style.display = nextState ? 'block' : 'none';
    dropdownTrigger?.classList.toggle('active', nextState);
  };

  dropdownTrigger?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleDropdown();
  });

  dropdownPanel?.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  const closePyramidModal = () => {
    toggleDropdown(false);
    modal.style.display = 'none';
    btnOpen.classList.remove('expanded');
    updateBtnTooltip();
  };

  const openPyramidModal = async () => {
    const provPopover = document.getElementById('prov-popover-menu');
    if (provPopover) provPopover.style.display = 'none';
    const provTriggerBtn = document.getElementById('btn-prov-dropdown-trigger');
    if (provTriggerBtn) provTriggerBtn.classList.remove('active');

    const searchPopover = document.getElementById('search-popover');
    if (searchPopover) searchPopover.style.display = 'none';

    toggleDropdown(false);

    btnOpen.classList.add('expanded');
    updateBtnTooltip();

    await syncOfflineManifest();
    renderProvinceGrid();
    updateEstimation();
    modal.style.display = 'flex';
  };

  const togglePyramidModal = () => {
    if (modal.style.display !== 'none') {
      closePyramidModal();
    } else {
      openPyramidModal();
    }
  };

  window.closePyramidModal = closePyramidModal;
  window.openPyramidModal = openPyramidModal;
  window.togglePyramidModal = togglePyramidModal;

  // 弹窗内部点击与外部空白处点击收起调度
  modal.addEventListener('click', (e) => {
    // 1. 如果省份下拉面板展开中，点击卡片内部空白处收起下拉面板
    if (dropdownPanel && dropdownPanel.style.display === 'block') {
      if (!dropdownTrigger?.contains(e.target) && !dropdownPanel?.contains(e.target)) {
        toggleDropdown(false);
      }
    }
    // 2. 如果点击的是遮罩空白背景处，收起整个弹窗并缩放回图标
    if (e.target === modal) {
      closePyramidModal();
    }
  });

  // 全局点击监听：弹窗开启时，点击外部任何空白处平滑收起并缩放回图标
  document.addEventListener('click', (e) => {
    if (modal.style.display !== 'none') {
      const modalCard = modal.querySelector('.modal-card');
      if (!modalCard?.contains(e.target) && !btnOpen.contains(e.target)) {
        closePyramidModal();
      }
    }
  });

  const getSelectedKeys = () => {
    if (!multiGrid) return [];
    const chks = multiGrid.querySelectorAll('input[type="checkbox"]:checked');
    return Array.from(chks).map(c => c.value);
  };

  const updateCounter = () => {
    const keys = getSelectedKeys();
    const totalCount = Object.keys(PROVINCES_DATA).filter(k => k !== 'china').length;
    if (counterBadge) {
      if (keys.length === totalCount) {
        counterBadge.innerText = `全选 (${keys.length} 省)`;
      } else {
        counterBadge.innerText = `已选 ${keys.length} 省`;
      }
    }
    if (dropdownSummary) {
      if (keys.length === 0) {
        dropdownSummary.innerText = '请点击展开选择目标省份...';
        dropdownSummary.style.color = '#94a3b8';
      } else if (keys.length === totalCount) {
        dropdownSummary.innerText = '全国 34 个省/直辖市/自治区 (已全选)';
        dropdownSummary.style.color = '#1e293b';
      } else {
        const names = keys.map(k => PROVINCES_DATA[k]?.name || k).filter(Boolean);
        if (names.length <= 4) {
          dropdownSummary.innerText = names.join('、');
        } else {
          dropdownSummary.innerText = `${names.slice(0, 3).join('、')} 等 ${names.length} 个省份`;
        }
        dropdownSummary.style.color = '#1e293b';
      }
    }
  };

  // 渲染全国省份网格 (去除字母前缀，已就绪带发光绿点并默认勾选)
  const renderProvinceGrid = () => {
    if (!multiGrid) return;
    multiGrid.innerHTML = '';
    const offlineState = getOfflineProvState();

    // 按拼音排序省份 (排除 china)
    const sortedKeys = Object.keys(PROVINCES_DATA)
      .filter(k => k !== 'china')
      .sort((a, b) => {
        const pa = PROVINCES_DATA[a];
        const pb = PROVINCES_DATA[b];
        return (pa.pinyin || pa.name).localeCompare(pb.pinyin || pb.name, 'zh-Hans-CN');
      });

    sortedKeys.forEach(k => {
      const p = PROVINCES_DATA[k];
      const saved = offlineState[k];
      const isReady = saved && saved.maxZ >= 10;

      const label = document.createElement('label');
      label.className = `prov-chip-item${isReady ? ' ready checked' : ''}`;
      label.dataset.key = k;

      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.value = k;
      chk.checked = !!isReady; // 已全部下载就绪的省份默认勾选

      chk.addEventListener('change', () => {
        label.classList.toggle('checked', chk.checked);
        updateCounter();
        updateEstimation();
      });

      label.appendChild(chk);

      const spanName = document.createElement('span');
      spanName.className = 'prov-chip-name';
      spanName.innerText = p.name; // 不带字母前缀
      label.appendChild(spanName);

      const spanDot = document.createElement('span');
      spanDot.className = 'prov-chip-dot';
      spanDot.title = '该省份基础离线包已就绪';
      label.appendChild(spanDot);

      multiGrid.appendChild(label);
    });

    // 如果没有任何已就绪省份，默认勾选山东省
    const checked = multiGrid.querySelectorAll('input[type="checkbox"]:checked');
    if (checked.length === 0) {
      const sdItem = multiGrid.querySelector('input[value="shandong"]');
      if (sdItem) {
        sdItem.checked = true;
        sdItem.closest('.prov-chip-item')?.classList.add('checked');
      }
    }

    updateCounter();
  };

  // 快捷按钮：全选、反选、清空
  btnSelectAll?.addEventListener('click', () => {
    if (!multiGrid) return;
    multiGrid.querySelectorAll('.prov-chip-item').forEach(item => {
      const chk = item.querySelector('input[type="checkbox"]');
      if (chk) chk.checked = true;
      item.classList.add('checked');
    });
    updateCounter();
    updateEstimation();
  });

  btnSelectInvert?.addEventListener('click', () => {
    if (!multiGrid) return;
    multiGrid.querySelectorAll('.prov-chip-item').forEach(item => {
      const chk = item.querySelector('input[type="checkbox"]');
      if (chk) chk.checked = !chk.checked;
      item.classList.toggle('checked', chk ? chk.checked : false);
    });
    updateCounter();
    updateEstimation();
  });

  btnSelectNone?.addEventListener('click', () => {
    if (!multiGrid) return;
    multiGrid.querySelectorAll('.prov-chip-item').forEach(item => {
      const chk = item.querySelector('input[type="checkbox"]');
      if (chk) chk.checked = false;
      item.classList.remove('checked');
    });
    updateCounter();
    updateEstimation();
  });

  // 层级卡片 (Zoom Pills) 交互
  zoomPills.forEach(pill => {
    pill.addEventListener('click', () => {
      zoomPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const val = pill.dataset.value || '10';
      if (zoomInput) zoomInput.value = val;
      updateEstimation();
    });
  });

  // 实时估算金字塔切片总数与体积，并刷新已就绪层级圆点和状态文案
  const updateEstimation = () => {
    const selectedKeys = getSelectedKeys();
    const maxZ = parseInt(zoomInput ? zoomInput.value : '10') || 10;
    const offlineState = getOfflineProvState();

    // 1. 刷新各个层级卡片中的纯正翠绿微光圆点 ● (若已选省份全部在该层级已就绪，显示翠绿发光点)
    [10, 11, 12, 13, 14].forEach(z => {
      const dot = document.getElementById(`zoom-dot-${z}`);
      if (dot) {
        const isReadyForZ = selectedKeys.length > 0 && selectedKeys.every(k => {
          const s = offlineState[k];
          return s && (s.maxZ || 0) >= z;
        });
        dot.classList.toggle('ready', isReadyForZ);
      }
    });

    if (selectedKeys.length === 0) {
      statCount.innerText = '未选择省份';
      statSize.innerText = '0 MB';
      if (provStatusTag) provStatusTag.style.display = 'none';
      btnStart.style.display = 'inline-block';
      btnStart.disabled = true;
      btnStart.innerText = '请选择目标省份';
      if (btnRetry) btnRetry.style.display = 'none';
      if (btnDone) btnDone.style.display = 'none';
      return;
    }

    let totalIncrementalTiles = 0;
    let allReady = true;
    let minSavedZ = Infinity;
    let hasAnySaved = false;

    selectedKeys.forEach(k => {
      const prov = PROVINCES_DATA[k];
      if (!prov || !prov.bbox) return;
      const saved = offlineState[k];
      const savedMaxZ = saved ? (saved.maxZ || 0) : 0;
      if (savedMaxZ > 0) hasAnySaved = true;
      if (savedMaxZ < minSavedZ) minSavedZ = savedMaxZ;

      if (savedMaxZ < maxZ) {
        allReady = false;
        const [minLon, maxLon, minLat, maxLat] = prov.bbox;
        const startZ = savedMaxZ > 0 ? savedMaxZ + 1 : 0;
        for (let z = startZ; z <= maxZ; z++) {
          const n = 1 << z;
          const x1 = Math.max(0, Math.floor((minLon + 180) / 360 * n));
          const x2 = Math.min(n - 1, Math.floor((maxLon + 180) / 360 * n));
          const latRad1 = Math.min(85.0511, maxLat) * Math.PI / 180;
          const latRad2 = Math.max(-85.0511, minLat) * Math.PI / 180;
          const y1 = Math.max(0, Math.floor((1 - Math.log(Math.tan(latRad1) + 1 / Math.cos(latRad1)) / Math.PI) / 2 * n));
          const y2 = Math.min(n - 1, Math.floor((1 - Math.log(Math.tan(latRad2) + 1 / Math.cos(latRad2)) / Math.PI) / 2 * n));
          totalIncrementalTiles += (x2 - x1 + 1) * (y2 - y1 + 1);
        }
      }
    });

    let multiplier = 0;
    if (chkDem.checked) multiplier += 1;
    if (chkVec.checked) multiplier += 1;
    if (multiplier === 0) multiplier = 1;

    const totalTiles = totalIncrementalTiles * multiplier;

    if (allReady) {
      statCount.innerText = '已全部就绪';
      statSize.innerText = '0 MB';
      if (provStatusTag) {
        provStatusTag.style.display = 'inline-flex';
        provStatusTag.innerHTML = '<span class="downloaded-dot">●</span> 已全部就绪';
      }
      btnStart.style.display = 'none';
      if (btnRetry) btnRetry.style.display = 'inline-block';
      if (btnDone) btnDone.style.display = 'inline-block';
    } else {
      statCount.innerText = `${formatTileCount(totalTiles)} 块`;
      const avgBytes = 42 * 1024;
      const totalBytes = totalTiles * avgBytes;
      if (totalBytes > 1024 * 1024 * 1024) {
        statSize.innerText = `约 ${(totalBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
      } else {
        statSize.innerText = `约 ${(totalBytes / (1024 * 1024)).toFixed(1)} MB`;
      }

      if (provStatusTag) {
        provStatusTag.style.display = 'inline-flex';
        if (hasAnySaved && minSavedZ > 0) {
          provStatusTag.innerHTML = `<span class="downloaded-dot">●</span> 已下载 L1-L${minSavedZ}，将扩至 L${maxZ}`;
        } else {
          provStatusTag.innerHTML = `<span class="downloaded-dot">●</span> 将下载至 L${maxZ}`;
        }
      }

      btnStart.style.display = 'inline-block';
      btnStart.disabled = false;
      btnStart.innerText = hasAnySaved ? `扩充下载 (至 L${maxZ})` : `开始下载 (至 L${maxZ})`;
      if (btnRetry) btnRetry.style.display = 'none';
      if (btnDone) btnDone.style.display = 'none';
    }
  };

  btnOpen.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePyramidModal();
  });

  btnClose.addEventListener('click', () => {
    closePyramidModal();
  });

  btnDone?.addEventListener('click', () => {
    setDownloadDotState('idle');
    closePyramidModal();
  });

  chkDem.addEventListener('change', updateEstimation);
  chkVec.addEventListener('change', updateEstimation);

  // 触发多省批量下载任务 (isVerify 为 true 时极速本地校验，false 时增量免重下载)
  const triggerDownload = async (isVerify = false) => {
    const selectedKeys = getSelectedKeys();
    if (selectedKeys.length === 0) return;

    const provinces = selectedKeys.map(k => {
      const p = PROVINCES_DATA[k];
      return { key: k, name: p.name, bbox: p.bbox };
    });

    const maxZ = parseInt(zoomInput ? zoomInput.value : '10') || 10;

    setDownloadDotState('downloading');
    btnStart.style.display = 'none';
    btnCancel.style.display = 'inline-block';
    if (btnRetry) btnRetry.style.display = 'none';
    if (btnDone) btnDone.style.display = 'none';
    progressBox.style.display = 'flex';
    progressFill.style.width = '0%';
    progressNum.innerText = isVerify ? '正在高速校验本地已缓存切片...' : '正在准备批量免重下载通道...';

    if (window.electronAPI && window.electronAPI.startPyramidDownload) {
      try {
        await window.electronAPI.startPyramidDownload({
          provinces,
          minZ: 0,
          maxZ,
          downloadDem: chkDem.checked,
          downloadVec: chkVec.checked,
          isVerify
        });
      } catch (err) {
        setDownloadDotState('idle');
        progressNum.innerText = `下载遇到异常: ${err.message}`;
      }
    }
  };

  btnStart.addEventListener('click', () => triggerDownload(false));
  btnRetry?.addEventListener('click', () => triggerDownload(true));

  // 中止下载
  btnCancel.addEventListener('click', async () => {
    setDownloadDotState('idle');
    if (window.electronAPI && window.electronAPI.cancelPyramidDownload) {
      await window.electronAPI.cancelPyramidDownload();
    }
    btnStart.style.display = 'inline-block';
    btnStart.disabled = false;
    btnStart.innerText = '开始下载';
    btnCancel.style.display = 'none';
    if (btnRetry) btnRetry.style.display = 'none';
    progressNum.innerText = '已中止下载';
  });

  // 监听后台批量下载进度广播与完成落盘
  if (window.electronAPI && window.electronAPI.onDownloadProgress) {
    window.electronAPI.onDownloadProgress(data => {
      progressFill.style.width = `${data.percent}%`;
      const maxZ = parseInt(zoomInput ? zoomInput.value : '10') || 10;
      const countPart = `${formatTileCount(data.completed)} / ${formatTileCount(data.total)}`;

      if (data.isVerify) {
        progressNum.innerText = `校验中: ${countPart}`;
      } else {
        progressNum.innerText = `正在下载至 L${maxZ} (${countPart})`;
      }
      progressSpeed.innerText = `速度: ${data.speed} 片/秒`;
      progressPct.innerText = `${data.percent}%`;

      if (!data.done && downloadDotState !== 'downloading') {
        setDownloadDotState('downloading');
      }

      // 关键：下载过程中实时联动刷新顶栏切片数与磁盘体积！
      const titleStat = document.getElementById('titlebar-cache-stat');
      if (titleStat && data.totalTiles) {
        titleStat.innerText = `离线: ${formatTileDisplay(data.totalTiles, data.totalBytes)}`;
        titleStat.title = `本地已缓存离线切片: ${data.totalTiles.toLocaleString()} 块 (下载中实时更新)`;
      }

      if (data.done) {
        setDownloadDotState('completed');
        const selectedKeys = getSelectedKeys();
        selectedKeys.forEach(k => {
          saveOfflineProvState(k, maxZ, { dem: chkDem.checked, vec: chkVec.checked });
        });

        btnStart.style.display = 'none';
        btnCancel.style.display = 'none';
        if (btnDone) btnDone.style.display = 'inline-block';
        if (btnRetry) btnRetry.style.display = 'inline-block';

        if (provStatusTag) {
          provStatusTag.style.display = 'inline-flex';
          provStatusTag.innerHTML = '<span class="downloaded-dot">●</span> 全部图层已就绪';
        }

        renderProvinceGrid();
        updateEstimation();

        // 刷新顶栏切片真实总数与体积
        if (titleStat) {
          const totalVal = data.totalTiles || data.savedCount || data.completed;
          titleStat.innerText = `离线: ${formatTileDisplay(totalVal, data.totalBytes)}`;
          titleStat.title = `本地已缓存离线切片总数: ${totalVal.toLocaleString()} 块${data.totalBytes ? ` · 占用磁盘: ${formatBytes(data.totalBytes)}` : ''} (点击可重新校准磁盘)`;
        }
      }
    });
  }
}

// 软件版本在线微更新系统 (点击最左侧 Logo 原地 3D 翻转，底色为进度条，完成提示覆盖安装，0弹窗)
function setupAppUpdate() {
  const brandBtn = document.getElementById('header-brand-logo-btn');
  const brandFlipCard = document.getElementById('brand-flip-card');
  const brandFlipBackFace = document.getElementById('brand-flip-back-face');
  const brandProgressBar = document.getElementById('brand-update-progress-bar');
  const brandVerBadge = document.getElementById('brand-ver-badge-txt');
  const brandLogo = brandBtn ? brandBtn.querySelector('.header-brand-logo') : null;

  if (!brandBtn || !brandFlipCard || !brandVerBadge) return;

  let isUpdating = false;
  let isReadyToInstall = false;
  let isChecking = false;
  let pendingUpdate = null;
  let autoFlipTimer = null;

  const flipToFront = () => {
    if (isUpdating && !isReadyToInstall) return;
    clearTimeout(autoFlipTimer);
    brandFlipCard.classList.remove('flipped');
    isUpdating = false;
    isReadyToInstall = false;
  };

  // 左键点击 Logo 区域触发原地 3D 翻转微交互
  brandBtn.addEventListener('click', async (e) => {
    // 1. 若已下载完毕，提示“覆盖安装”，再点击一下此标签即执行覆盖安装
    if (isReadyToInstall) {
      e.stopPropagation();
      if (window.electronAPI && window.electronAPI.installAppUpdate) {
        window.electronAPI.installAppUpdate();
      }
      return;
    }

    if (isUpdating) return;

    // 2. 图标微旋转反馈
    if (brandLogo) {
      brandLogo.classList.remove('checking-spin');
      void brandLogo.offsetWidth;
      brandLogo.classList.add('checking-spin');
    }

    // 3. 若当前已处于翻转状态
    if (brandFlipCard.classList.contains('flipped')) {
      // 若有待安装的新版本，点击红标签直接启动原地更新
      if (pendingUpdate && pendingUpdate.hasUpdate) {
        startInPlaceUpdate();
        return;
      }
      // 再次点击直接翻转复原
      flipToFront();
      return;
    }

    // 4. 执行 3D 翻转
    clearTimeout(autoFlipTimer);
    brandFlipCard.classList.add('flipped');
    brandFlipBackFace?.classList.remove('latest', 'has-update');
    brandFlipBackFace?.removeAttribute('title');
    brandBtn?.removeAttribute('title');
    if (brandProgressBar) brandProgressBar.style.width = '0%';

    let currentVer = '1.2.8';
    if (window.electronAPI && window.electronAPI.getAppVersion) {
      try {
        currentVer = await window.electronAPI.getAppVersion();
      } catch (err) {}
    }
    const verClean = String(currentVer).replace(/^v/, '');
    brandVerBadge.innerText = `v${verClean}`;

    if (isChecking) return;
    isChecking = true;

    try {
      if (window.electronAPI && window.electronAPI.checkForUpdates) {
        const updateInfo = await window.electronAPI.checkForUpdates();
        isChecking = false;

        if (updateInfo && updateInfo.hasUpdate) {
          pendingUpdate = updateInfo;
          const newVer = String(updateInfo.version).replace(/^v/, '');
          brandFlipBackFace?.classList.remove('latest');
          brandFlipBackFace?.classList.add('has-update');
          brandVerBadge.innerText = `v${newVer}`;
          brandFlipBackFace?.removeAttribute('title');
          return;
        } else {
          // 无新版本：显示绿色当前版本号
          brandFlipBackFace?.classList.remove('has-update');
          brandFlipBackFace?.classList.add('latest');
          brandVerBadge.innerText = `v${verClean}`;
          brandFlipBackFace?.removeAttribute('title');
        }
      } else {
        isChecking = false;
        brandFlipBackFace?.classList.add('latest');
        brandVerBadge.innerText = `v${verClean}`;
        brandFlipBackFace?.removeAttribute('title');
      }
    } catch (err) {
      isChecking = false;
      brandFlipBackFace?.classList.add('latest');
      brandVerBadge.innerText = `v${verClean}`;
      brandFlipBackFace?.removeAttribute('title');
    }

    // 无新版或网络正常时，3.5秒后自动平滑翻转复原
    autoFlipTimer = setTimeout(() => {
      flipToFront();
    }, 3500);
  });

  // 原地静默启动更新下载，以标签底色为进度条
  const startInPlaceUpdate = async () => {
    if (!pendingUpdate || isUpdating) return;
    if (!window.electronAPI || !window.electronAPI.startAppUpdate) return;

    isUpdating = true;
    isReadyToInstall = false;
    clearTimeout(autoFlipTimer);
    brandVerBadge.innerText = '0%';
    if (brandProgressBar) brandProgressBar.style.width = '0%';

    // 监听实时下载进度
    window.electronAPI.onUpdateProgress(data => {
      const pct = Math.min(100, Math.max(0, data.percent || 0));
      if (brandProgressBar) brandProgressBar.style.width = `${pct}%`;
      if (pct < 100) {
        brandVerBadge.innerText = `${pct}%`;
      } else {
        brandProgressBar.style.width = '100%';
        brandVerBadge.innerText = '覆盖安装';
        brandFlipBackFace?.classList.remove('has-update');
        brandFlipBackFace?.classList.add('latest');
        brandFlipBackFace?.removeAttribute('title');
        isReadyToInstall = true;
      }
    });

    try {
      const res = await window.electronAPI.startAppUpdate({
        downloadUrl: pendingUpdate.downloadUrl,
        backupUrl: pendingUpdate.backupUrl
      });
      if (!res.success) {
        isUpdating = false;
        isReadyToInstall = false;
        brandVerBadge.innerText = '更新失败';
        setTimeout(flipToFront, 2500);
      }
    } catch (err) {
      isUpdating = false;
      isReadyToInstall = false;
      brandVerBadge.innerText = '更新异常';
      setTimeout(flipToFront, 2500);
    }
  };

  // 点击外部任意区域或按下 ESC 时翻转复原
  document.addEventListener('click', (e) => {
    if (!brandBtn.contains(e.target) && (!isUpdating || isReadyToInstall)) {
      flipToFront();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && (!isUpdating || isReadyToInstall) && brandFlipCard.classList.contains('flipped')) {
      flipToFront();
    }
  });
}

/// 全局实时云端漫游同步引擎 (支持标记增删改、路线保存与删除、视角与配置变动的后台秒级自动持久化到 R2)
let cloudSyncDebounceTimer = null;

async function triggerRealtimeCloudSync(reason = 'change') {
  if (!window.electronAPI || !window.electronAPI.uploadCloudSyncData) return;

  clearTimeout(cloudSyncDebounceTimer);
  cloudSyncDebounceTimer = setTimeout(async () => {
    try {
      let syncKey = 'default';
      if (window.electronAPI.getCloudSyncConfig) {
        const cfg = await window.electronAPI.getCloudSyncConfig();
        if (cfg) {
          if (cfg.autoSync === false) return; // 自动漫游已关闭
          if (cfg.syncKey) syncKey = cfg.syncKey.trim();
        }
      }

      const payload = {
        syncKey: syncKey || 'default',
        data: {
          version: '1.2.8',
          syncedAt: new Date().toISOString(),
          favorites: JSON.parse(localStorage.getItem('outmap_saved_waypoints') || '[]'),
          folders: JSON.parse(localStorage.getItem('outmap_custom_folders') || '[]'),
          routes: JSON.parse(localStorage.getItem('outmap_saved_routes') || '[]'),
          views: window.mapInstance ? {
            center: window.mapInstance.getCenter(),
            zoom: window.mapInstance.getZoom(),
            pitch: window.mapInstance.getPitch(),
            bearing: window.mapInstance.getBearing()
          } : null,
          settings: {
            pitchLocked: localStorage.getItem('outmap_pitch_locked') === '1',
            lockedPitchVal: localStorage.getItem('outmap_locked_pitch_val') || '50'
          }
        }
      };

      const res = await window.electronAPI.uploadCloudSyncData(payload);
      if (res && res.success) {
        console.log(`[CloudSync] 实时自动同步成功 (${reason})`);
        const statusText = document.getElementById('sync-status-text');
        if (statusText) {
          const nowStr = new Date().toLocaleTimeString('zh-CN', { hour12: false });
          statusText.innerText = `上次同步: ${nowStr}`;
        }
      }
    } catch (e) {
      console.warn('[CloudSync] 实时自动同步后台提示:', e.message);
    }
  }, 1200);
}
window.triggerRealtimeCloudSync = triggerRealtimeCloudSync;

// 多设备云端漫游同步系统 (右键 Logo 呼出)
function setupCloudSync(map) {
  const brandBtn = document.getElementById('header-brand-logo-btn');
  const syncModal = document.getElementById('sync-modal');
  const btnClose = document.getElementById('btn-close-sync-modal');
  const btnCloseBtn = document.getElementById('btn-close-sync-btn');
  const keyInput = document.getElementById('sync-account-key');
  const chkAutoSync = document.getElementById('chk-auto-sync-toggle');
  const chkFav = document.getElementById('chk-sync-favorites');
  const chkRoutes = document.getElementById('chk-sync-routes');
  const chkViews = document.getElementById('chk-sync-views');
  const statusIndicator = document.getElementById('sync-status-indicator');
  const statusText = document.getElementById('sync-status-text');
  const btnSyncNow = document.getElementById('btn-do-sync-now');

  if (!brandBtn || !syncModal) return;

  const showStatus = (msg, isErr = false) => {
    if (!statusText) return;
    statusText.innerHTML = msg;
    const dot = statusIndicator?.querySelector('.sync-dot-live');
    if (dot) {
      dot.style.color = isErr ? '#ef4444' : '#16a34a';
      dot.style.textShadow = isErr ? '0 0 6px rgba(239, 68, 68, 0.8)' : '0 0 6px rgba(22, 163, 74, 0.8)';
    }
    if (statusIndicator) {
      statusIndicator.style.background = isErr ? '#fef2f2' : '#f0fdf4';
      statusIndicator.style.borderColor = isErr ? '#fecaca' : '#bbf7d0';
      statusIndicator.style.color = isErr ? '#991b1b' : '#166534';
    }
  };

  // 监听地图视口停止拖动/平移，实时自动同步当前中心点与仰角
  map.on('moveend', () => {
    triggerRealtimeCloudSync('view_changed');
  });

  // 执行双向智能合并同步
  const doBidirectionalSync = async () => {
    let key = (keyInput ? keyInput.value : 'default').trim() || 'default';

    showStatus('正在同步...');
    if (btnSyncNow) btnSyncNow.disabled = true;

    try {
      // 1. 先从云端拉取数据
      let cloudData = null;
      if (window.electronAPI && window.electronAPI.pullCloudSyncData) {
        const pullRes = await window.electronAPI.pullCloudSyncData({ syncKey: key });
        if (pullRes && pullRes.success && pullRes.data) {
          cloudData = pullRes.data;
        }
      }

      // 2. 读取本地数据
      const localFavs = JSON.parse(localStorage.getItem('outmap_saved_waypoints') || '[]');
      const localRoutes = JSON.parse(localStorage.getItem('outmap_saved_routes') || '[]');
      const localFolders = JSON.parse(localStorage.getItem('outmap_custom_folders') || '[]');

      // 3. 智能双向求并集合并 (Merge: 双方新数据均保留)
      const mergedFavs = (chkFav && chkFav.checked && cloudData) ? mergeWaypoints(localFavs, cloudData.favorites) : localFavs;
      const mergedRoutes = (chkRoutes && chkRoutes.checked && cloudData) ? mergeRoutes(localRoutes, cloudData.routes) : localRoutes;
      const mergedFolders = cloudData ? mergeFolders(localFolders, cloudData.folders) : localFolders;

      // 4. 写回本地并刷新界面标记与列表
      localStorage.setItem('outmap_saved_waypoints', JSON.stringify(mergedFavs));
      localStorage.setItem('outmap_saved_routes', JSON.stringify(mergedRoutes));
      localStorage.setItem('outmap_custom_folders', JSON.stringify(mergedFolders));

      if (chkViews && chkViews.checked && cloudData && cloudData.views && cloudData.views.center) {
        map.flyTo({
          center: cloudData.views.center,
          zoom: cloudData.views.zoom || 4.0,
          pitch: cloudData.views.pitch || 50,
          bearing: cloudData.views.bearing || 0
        });
      }

      window.dispatchEvent(new Event('storage'));

      // 5. 将合并后的最新全量数据推送回云端
      const payload = {
        syncKey: key,
        data: {
          version: '1.2.10',
          syncedAt: new Date().toISOString(),
          favorites: mergedFavs,
          folders: mergedFolders,
          routes: mergedRoutes,
          views: {
            center: map.getCenter(),
            zoom: map.getZoom(),
            pitch: map.getPitch(),
            bearing: map.getBearing()
          },
          settings: {
            pitchLocked: localStorage.getItem('outmap_pitch_locked') === '1',
            lockedPitchVal: localStorage.getItem('outmap_locked_pitch_val') || '50'
          }
        }
      };

      if (window.electronAPI && window.electronAPI.uploadCloudSyncData) {
        const upRes = await window.electronAPI.uploadCloudSyncData(payload);
        if (!upRes || !upRes.success) {
          throw new Error(upRes?.message || '上传云端失败');
        }
      }

      const nowTime = new Date().toLocaleTimeString('zh-CN', { hour12: false });
      if (window.electronAPI && window.electronAPI.saveCloudSyncConfig) {
        await window.electronAPI.saveCloudSyncConfig({
          syncKey: key,
          autoSync: chkAutoSync ? chkAutoSync.checked : true,
          lastSyncTime: nowTime
        });
      }

      showStatus(`同步完成 (${nowTime})`);
    } catch (err) {
      showStatus(`同步失败: ${err.message}`, true);
    } finally {
      if (btnSyncNow) btnSyncNow.disabled = false;
    }
  };

  btnSyncNow?.addEventListener('click', doBidirectionalSync);

  // 自动同步开关切换
  chkAutoSync?.addEventListener('change', async () => {
    const isAuto = chkAutoSync.checked;
    const key = (keyInput ? keyInput.value : 'default').trim() || 'default';
    if (window.electronAPI && window.electronAPI.saveCloudSyncConfig) {
      await window.electronAPI.saveCloudSyncConfig({ syncKey: key, autoSync: isAuto });
    }
    if (isAuto) {
      showStatus('已开启');
      triggerRealtimeCloudSync('switch_on');
    } else {
      showStatus('已暂停');
    }
  });

  // 右键 Logo 呼出云同步面板
  brandBtn.addEventListener('contextmenu', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    let lastTime = '';
    if (window.electronAPI && window.electronAPI.getCloudSyncConfig) {
      try {
        const cfg = await window.electronAPI.getCloudSyncConfig();
        if (cfg) {
          if (keyInput) keyInput.value = cfg.syncKey || 'default';
          if (chkAutoSync) chkAutoSync.checked = cfg.autoSync !== false;
          if (cfg.lastSyncTime) lastTime = cfg.lastSyncTime;
        }
      } catch (err) {}
    }

    if (chkAutoSync && chkAutoSync.checked) {
      showStatus(lastTime ? `上次同步: ${lastTime}` : '就绪');
    } else {
      showStatus('已暂停');
    }

    syncModal.style.display = 'flex';
  });

  const closeSync = () => {
    syncModal.style.display = 'none';
  };

  btnClose?.addEventListener('click', closeSync);
  btnCloseBtn?.addEventListener('click', closeSync);

  syncModal.addEventListener('click', (e) => {
    if (e.target === syncModal) {
      closeSync();
    }
  });
}

function flyToProvince(map, key) {
  const prov = PROVINCES_DATA[key];
  if (!prov) return;
  const targetPitch = key === 'china' ? 50 : (isPitchLocked ? map.getPitch() : prov.pitch);
  map.flyTo({
    center: prov.center,
    zoom: prov.zoom,
    pitch: targetPitch,
    bearing: 0,
    duration: 2200
  });
  if (key === 'china') {
    setTimeout(() => {
      if (typeof updatePitchLockFn === 'function') {
        updatePitchLockFn(true, 50);
      }
    }, 2250);
  }
  const regionEl = document.getElementById('status-region');
  if (regionEl) {
    if (key === 'china') {
      regionEl.innerText = '区域: 全国';
    } else {
      regionEl.innerText = `区域: ${prov.name}`;
    }
  }
}



// 重点地级市/省会/自治州地理范围 (用于状态栏精确反查“省·市·县”)
const CHINA_DIVISIONS = [
  // 四川
  { prov: '四川省', city: '成都市', bbox: [102.9, 104.9, 30.0, 31.5] },
  { prov: '四川省', city: '阿坝藏族羌族自治州', bbox: [100.5, 104.4, 30.5, 34.3] },
  { prov: '四川省', city: '甘孜藏族自治州', bbox: [97.3, 102.5, 27.9, 33.1] },
  { prov: '四川省', city: '凉山彝族自治州', bbox: [100.0, 103.9, 26.0, 29.5] },
  { prov: '四川省', city: '绵阳市', bbox: [103.7, 105.7, 30.7, 33.0] },
  { prov: '四川省', city: '乐山市', bbox: [102.8, 104.3, 28.8, 29.9] },
  { prov: '四川省', city: '雅安市', bbox: [102.1, 103.3, 29.4, 30.9] },
  // 山东
  { prov: '山东省', city: '济南市', bbox: [116.1, 117.7, 36.0, 37.5] },
  { prov: '山东省', city: '青岛市', bbox: [119.5, 121.2, 35.5, 37.2] },
  { prov: '山东省', city: '泰安市', bbox: [116.3, 117.9, 35.6, 36.5] },
  { prov: '山东省', city: '烟台市', bbox: [119.5, 122.0, 36.5, 38.4] },
  { prov: '山东省', city: '潍坊市', bbox: [118.1, 120.2, 35.7, 37.4] },
  { prov: '山东省', city: '临沂市', bbox: [117.4, 119.2, 34.4, 36.2] },
  { prov: '山东省', city: '威海市', bbox: [121.6, 122.7, 36.6, 37.6] },
  // 西藏
  { prov: '西藏自治区', city: '拉萨市', bbox: [89.7, 92.6, 29.2, 31.0] },
  { prov: '西藏自治区', city: '日喀则市', bbox: [82.0, 90.3, 27.5, 31.8] },
  { prov: '西藏自治区', city: '林芝市', bbox: [92.1, 98.9, 26.8, 30.7] },
  { prov: '西藏自治区', city: '昌都市', bbox: [95.5, 99.1, 28.5, 32.7] },
  { prov: '西藏自治区', city: '阿里地区', bbox: [78.4, 86.5, 30.0, 36.0] },
  // 云南
  { prov: '云南省', city: '昆明市', bbox: [102.1, 103.7, 24.3, 26.5] },
  { prov: '云南省', city: '丽江市', bbox: [99.3, 101.5, 25.9, 27.9] },
  { prov: '云南省', city: '大理白族自治州', bbox: [98.8, 101.3, 24.6, 26.7] },
  { prov: '云南省', city: '迪庆藏族自治州', bbox: [98.5, 100.3, 26.9, 29.2] },
  // 新疆
  { prov: '新疆维吾尔自治区', city: '乌鲁木齐市', bbox: [86.6, 88.9, 42.7, 44.3] },
  { prov: '新疆维吾尔自治区', city: '阿勒泰地区', bbox: [85.5, 91.1, 45.0, 49.2] },
  { prov: '新疆维吾尔自治区', city: '喀什地区', bbox: [73.5, 80.0, 35.4, 40.3] },
  { prov: '新疆维吾尔自治区', city: '伊犁哈萨克自治州', bbox: [80.1, 85.0, 42.2, 45.0] },
  // 陕西
  { prov: '陕西省', city: '西安市', bbox: [107.6, 109.8, 33.6, 34.8] },
  { prov: '陕西省', city: '延安市', bbox: [107.6, 110.5, 35.3, 37.5] },
  { prov: '陕西省', city: '汉中市', bbox: [105.5, 108.3, 32.4, 34.0] },
  // 直辖市
  { prov: '北京市', city: '北京市', bbox: [115.4, 117.5, 39.4, 41.1] },
  { prov: '上海市', city: '上海市', bbox: [120.8, 122.2, 30.7, 31.9] },
  { prov: '重庆市', city: '重庆市', bbox: [105.3, 110.2, 28.2, 32.2] },
  { prov: '天津市', city: '天津市', bbox: [116.7, 118.1, 38.5, 40.3] },
  // 东南沿海
  { prov: '浙江省', city: '杭州市', bbox: [118.3, 120.7, 29.1, 30.6] },
  { prov: '广东省', city: '广州市', bbox: [112.9, 114.1, 22.4, 23.9] },
  { prov: '广东省', city: '深圳市', bbox: [113.7, 114.7, 22.4, 22.9] }
];

// 智能解算当前坐标所属的“市 · 县/区/镇”或完整行政区划 (支持仅显示市、县两级)
function resolveLocationInfo(map, lngLat, point, onlyCityCounty = false) {
  const zoom = map.getZoom();
  if (zoom < 5.0) {
    return onlyCityCounty ? '地点' : '区域: 全国';
  }

  const { lng, lat } = lngLat;
  let foundProv = '';
  let foundCity = '';

  // 1. 空间包围盒优先匹配市州
  for (let i = 0; i < CHINA_DIVISIONS.length; i++) {
    const div = CHINA_DIVISIONS[i];
    const [x1, x2, y1, y2] = div.bbox;
    if (lng >= x1 && lng <= x2 && lat >= y1 && lat <= y2) {
      foundProv = div.prov;
      foundCity = div.city;
      break;
    }
  }

  // 2. 若未精准落入重点市州范围，则匹配 34 省份地理包围盒
  if (!foundProv) {
    const keys = Object.keys(PROVINCES_DATA);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (k === 'china') continue;
      const p = PROVINCES_DATA[k];
      const [x1, x2, y1, y2] = p.bbox;
      if (lng >= x1 && lng <= x2 && lat >= y1 && lat <= y2) {
        foundProv = p.name;
        break;
      }
    }
  }

  if (!foundProv && !foundCity) {
    return onlyCityCounty ? '地点' : '区域: 全国';
  }

  // 3. 从矢量图层探查光标所在微观县/区/镇/著名山峰
  let microFeature = '';
  if (point) {
    try {
      const bbox = [[point.x - 35, point.y - 35], [point.x + 35, point.y + 35]];
      const feats = map.queryRenderedFeatures(bbox, {
        layers: ['osm-places-towns', 'osm-places-villages', 'osm-places-cities', 'osm-mountain-peaks', 'osm-outdoor-scenic-pois']
      });
      if (feats && feats.length > 0) {
        for (let i = 0; i < feats.length; i++) {
          const f = feats[i];
          const name = f.properties['name:zh'] || f.properties.name_zh || f.properties.name;
          if (name && name !== foundCity && name !== foundProv) {
            microFeature = name;
            break;
          }
        }
      }
    } catch (e) {}
  }

  // 仅显示市、县两级 (例如：延安市 · 延长县, 北京市 · 朝阳区)
  if (onlyCityCounty) {
    if (foundCity && microFeature) {
      return `${foundCity} · ${microFeature}`;
    } else if (foundCity) {
      return foundCity;
    } else if (foundProv && microFeature) {
      return `${foundProv} · ${microFeature}`;
    } else if (microFeature) {
      return microFeature;
    } else {
      return foundProv || '地点';
    }
  }

  if (foundCity && microFeature) {
    return `区域: ${foundProv} · ${foundCity} · ${microFeature}`;
  } else if (foundCity) {
    return `区域: ${foundProv} · ${foundCity}`;
  } else if (microFeature) {
    return `区域: ${foundProv} · ${microFeature}`;
  } else {
    return `区域: ${foundProv}`;
  }
}

// 获取经由真实客观海拔校准的地表高程 (米)
// MapLibre 的 queryTerrainElevation 默认返回的是经由 3D 渲染夸张系数 (exaggeration) 放大后的 WebGL 空间高程
// 必须除以当前的 exaggeration 系数，才能得到真实准确的物理海拔高度 (消除高程翻倍Bug)
function getRealElevation(map, lngLat) {
  if (!map || typeof map.queryTerrainElevation !== 'function' || !lngLat) return null;
  try {
    const raw = map.queryTerrainElevation(lngLat);
    if (raw === null || raw === undefined || isNaN(raw)) return null;
    const terrain = map.getTerrain ? map.getTerrain() : null;
    const ex = (terrain && terrain.exaggeration) ? terrain.exaggeration : (currentExaggeration || 1.0);
    return raw / (ex || 1.0);
  } catch (e) {
    return null;
  }
}

function setupStatusBar(map) {
  const sCoords = document.getElementById('status-coords');
  const sElevation = document.getElementById('status-elevation');
  const sPitch = document.getElementById('status-pitch');
  const sBearing = document.getElementById('status-bearing');
  const sZoom = document.getElementById('status-zoom');
  const sRegion = document.getElementById('status-region');

  let lastResolveTime = 0;
  let rafPending = false;
  let latestMouseEvt = null;

  map.on('mousemove', e => {
    latestMouseEvt = e;
    if (rafPending) return;
    rafPending = true;

    requestAnimationFrame(() => {
      rafPending = false;
      if (!latestMouseEvt) return;
      const ev = latestMouseEvt;
      if (sCoords) sCoords.innerText = `坐标: ${ev.lngLat.lng.toFixed(4)}°E, ${ev.lngLat.lat.toFixed(4)}°N`;

      // 地图处于拖拽平移/缩放动画时跳过耗时的 GPU 高程读取与要素探测，彻底消除平移掉帧卡顿
      if (map.isMoving && map.isMoving()) return;

      try {
        const ele = getRealElevation(map, ev.lngLat);
        if (sElevation) {
          if (ele !== null && ele !== undefined) {
            sElevation.innerText = `地表高程: ${Math.round(ele)} m`;
          } else {
            sElevation.innerText = `地表高程: -- m`;
          }
        }
      } catch (err) {}

      // 节流实时反查并更新“省 · 市 · 县/镇/峰”
      const now = performance.now();
      if (now - lastResolveTime > 250 && sRegion) {
        lastResolveTime = now;
        sRegion.innerText = resolveLocationInfo(map, ev.lngLat, ev.point);
      }
    });
  });

  map.on('move', () => {
    if (sPitch) sPitch.innerText = `俯仰: ${Math.round(map.getPitch())}°`;
    if (sBearing) sBearing.innerText = `航向: ${Math.round(map.getBearing())}°`;
    if (sZoom) sZoom.innerText = `层级: ${map.getZoom().toFixed(1)}`;
  });

  let fc = 0;
  let lt = performance.now();
  function loop() {
    fc++;
    const now = performance.now();
    if (now - lt >= 1000) {
      const fps = Math.round((fc * 1000) / (now - lt));
      const el = document.getElementById('status-fps');
      if (el) el.innerText = `${fps} FPS`;
      fc = 0;
      lt = now;
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

// =========================================================
// 选点与收藏夹管理系统 (Waypoint & Favorites)
// =========================================================
let savedWaypoints = [];
let savedRoutes = []; // 本地持久化收藏路线列表
let currentPlannedRouteCoords = []; // 当前规划的完整经纬度坐标
let currentRouteMetrics = null; // 当前规划的核心指标 (距离、爬升等)
let renderSavedRoutesListFn = null;
let waypointMarkers = [];
let customFolders = []; // 用户持久化自定义收藏夹分类
let isPickingPoint = false;
let tempPickedPoint = null;

// 右下角悬浮面板统一互斥调度管理 (收藏抽屉、新建地标收藏弹窗、路线规划面板互斥关闭，杜绝界面重叠)
function closeConflictingBottomPanels(exceptId = null) {
  const panelIds = ['waypoint-modal', 'favorites-drawer', 'route-panel'];
  panelIds.forEach(id => {
    if (id !== exceptId) {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    }
  });
}
if (typeof window !== 'undefined') {
  window.closeConflictingBottomPanels = closeConflictingBottomPanels;
}

function setupWaypointAndFavoritesSystem(map) {
  const btnFabPoint = document.getElementById('btn-fab-point');
  const btnFabFav = document.getElementById('btn-fab-fav');
  const wpModal = document.getElementById('waypoint-modal');
  const btnCloseWp = document.getElementById('btn-close-waypoint-modal');
  const btnCancelWp = document.getElementById('btn-cancel-waypoint');
  const btnSaveWp = document.getElementById('btn-save-waypoint');
  const wpNameInput = document.getElementById('wp-name');
  const wpCoordsVal = document.getElementById('wp-coords-val');
  const wpEleVal = document.getElementById('wp-ele-val');
  const wpFolderSelect = document.getElementById('wp-folder-select');
  const btnAddFolder = document.getElementById('btn-add-folder');
  const newFolderInline = document.getElementById('new-folder-inline');
  const newFolderInput = document.getElementById('new-folder-input');
  const btnConfirmNewFolder = document.getElementById('btn-confirm-new-folder');
  const btnCancelNewFolder = document.getElementById('btn-cancel-new-folder');

  const favDrawer = document.getElementById('favorites-drawer');
  const btnCloseFav = document.getElementById('btn-close-favorites-drawer');
  const favTabs = document.getElementById('fav-folder-tabs');
  const favList = document.getElementById('fav-items-list');

  // 读取本地持久化收藏夹、自定义分类与收藏路线
  try {
    const raw = localStorage.getItem('outmap_saved_waypoints');
    if (raw) savedWaypoints = JSON.parse(raw);
    const rawFolders = localStorage.getItem('outmap_custom_folders');
    if (rawFolders) customFolders = JSON.parse(rawFolders);
    const rawRoutes = localStorage.getItem('outmap_saved_routes');
    if (rawRoutes) savedRoutes = JSON.parse(rawRoutes);
  } catch (e) {}

  // 刷新收藏夹下拉选择框
  const refreshFolderOptions = (selectedVal) => {
    if (!wpFolderSelect) return;
    wpFolderSelect.innerHTML = `
      <option value="default">⭐ 默认收藏夹</option>
      <option value="camp">⛺ 我的露营地</option>
      <option value="hiking">🥾 徒步穿越点</option>
    `;
    customFolders.forEach(f => {
      const opt = document.createElement('option');
      opt.value = f.id;
      opt.innerText = `📁 ${f.name}`;
      wpFolderSelect.appendChild(opt);
    });
    if (selectedVal) wpFolderSelect.value = selectedVal;
  };
  refreshFolderOptions();

  // 渲染已有标记点到地图 (按要求已移除险段，保留4种户外核心类型)
  const renderWaypointMarkersOnMap = () => {
    waypointMarkers.forEach(m => m.remove());
    waypointMarkers = [];

    const iconMap = {
      camp: '🏕️',
      view: '🏔️',
      water: '💧',
      supply: '⛽'
    };

    savedWaypoints.forEach(wp => {
      const el = document.createElement('div');
      el.className = 'custom-waypoint-marker';
      el.style.cssText = `
        background: #ffffff;
        border: 2px solid #0284c7;
        border-radius: 50%;
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 13px;
        box-shadow: 0 3px 8px rgba(0,0,0,0.25);
        cursor: pointer;
        transition: transform 0.15s ease;
      `;
      el.innerText = iconMap[wp.type] || '📍';
      el.title = `${wp.name} (${wp.ele}m)`;

      el.addEventListener('mouseenter', () => el.style.transform = 'scale(1.25)');
      el.addEventListener('mouseleave', () => el.style.transform = 'scale(1.0)');
      el.addEventListener('click', () => {
        const curPitch = isPitchLocked ? map.getPitch() : Math.min(map.getPitch() || 50, 52);
        const cameraCenter = calculateOffsetCameraCenter(map, [wp.lng, wp.lat], 14.5, curPitch, 0.67);
        map.flyTo({ center: cameraCenter, zoom: 14.5, pitch: curPitch, offset: [0, 0], duration: 1200 });
      });

      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([wp.lng, wp.lat])
        .addTo(map);

      waypointMarkers.push(marker);
    });
  };

  renderWaypointMarkersOnMap();

  // 点击选点按钮进入/退出选点状态
  if (btnFabPoint) {
    btnFabPoint.addEventListener('click', () => {
      isPickingPoint = !isPickingPoint;
      btnFabPoint.classList.toggle('active', isPickingPoint);
      map.getCanvas().style.cursor = isPickingPoint ? 'crosshair' : '';
      if (isPickingPoint) {
        if (wpModal) wpModal.style.display = 'none';
      }
    });
  }

  // 地图点击拾取点
  map.on('click', e => {
    if (!isPickingPoint) return;
    isPickingPoint = false;
    if (btnFabPoint) btnFabPoint.classList.remove('active');
    map.getCanvas().style.cursor = '';

    const { lng, lat } = e.lngLat;
    const ele = Math.round(getRealElevation(map, e.lngLat) || 0);

    tempPickedPoint = { lng, lat, ele };

    if (wpCoordsVal) wpCoordsVal.innerText = `${lng.toFixed(4)}°E, ${lat.toFixed(4)}°N`;
    if (wpEleVal) wpEleVal.innerText = `${ele} m`;
    if (wpNameInput) {
      wpNameInput.value = `标记点 · ${ele}m`;
      wpNameInput.focus();
    }
    closeConflictingBottomPanels('waypoint-modal');
    if (wpModal) wpModal.style.display = 'flex';
  });

  // 4类地标类型胶囊单选
  let selectedType = 'camp';
  document.querySelectorAll('#wp-type-group .type-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('#wp-type-group .type-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      selectedType = pill.getAttribute('data-type');
    });
  });

  // 保存标记点
  const closeWpModal = () => {
    if (wpModal) wpModal.style.display = 'none';
    if (newFolderInline) newFolderInline.style.display = 'none';
    tempPickedPoint = null;
  };

  // 挂载全局调用：一键为指定坐标和地名打开收藏添加弹窗
  window.openWaypointModalForLocation = (coords, name) => {
    const [lng, lat] = coords;
    const ele = Math.round(getRealElevation(map, { lng, lat }) || 0);
    tempPickedPoint = { lng, lat, ele };
    if (wpCoordsVal) wpCoordsVal.innerText = `${lng.toFixed(4)}°E, ${lat.toFixed(4)}°N`;
    if (wpEleVal) wpEleVal.innerText = `${ele} m`;
    if (wpNameInput) {
      wpNameInput.value = name || `地标 · ${ele}m`;
      wpNameInput.focus();
    }
    closeConflictingBottomPanels('waypoint-modal');
    if (wpModal) wpModal.style.display = 'flex';
  };

  btnCloseWp?.addEventListener('click', closeWpModal);
  btnCancelWp?.addEventListener('click', closeWpModal);

  btnSaveWp?.addEventListener('click', () => {
    if (!tempPickedPoint) return;
    const name = (wpNameInput.value || '').trim() || `地标 · ${tempPickedPoint.ele}m`;
    const folder = wpFolderSelect ? wpFolderSelect.value : 'default';

    const newWp = {
      id: 'wp_' + Date.now(),
      name,
      type: selectedType,
      folder,
      lng: tempPickedPoint.lng,
      lat: tempPickedPoint.lat,
      ele: tempPickedPoint.ele,
      time: new Date().toLocaleDateString()
    };

    savedWaypoints.push(newWp);
    try {
      localStorage.setItem('outmap_saved_waypoints', JSON.stringify(savedWaypoints));
    } catch (e) {}

    renderWaypointMarkersOnMap();
    closeWpModal();
    if (typeof window.triggerRealtimeCloudSync === 'function') {
      window.triggerRealtimeCloudSync('add_waypoint');
    }
  });

  // 新建收藏夹内联操作 (替代被系统拦截的 prompt)
  btnAddFolder?.addEventListener('click', () => {
    if (newFolderInline) {
      const isVisible = newFolderInline.style.display !== 'none';
      newFolderInline.style.display = isVisible ? 'none' : 'flex';
      if (!isVisible && newFolderInput) {
        newFolderInput.value = '';
        newFolderInput.focus();
      }
    }
  });

  const confirmNewFolder = () => {
    if (!newFolderInput) return;
    const name = newFolderInput.value.trim();
    if (!name) return;

    const newFolderObj = {
      id: 'folder_' + Date.now(),
      name: name
    };
    customFolders.push(newFolderObj);
    try {
      localStorage.setItem('outmap_custom_folders', JSON.stringify(customFolders));
    } catch (e) {}

    refreshFolderOptions(newFolderObj.id);
    renderFolderTabs();
    if (newFolderInline) newFolderInline.style.display = 'none';
    if (typeof window.triggerRealtimeCloudSync === 'function') {
      window.triggerRealtimeCloudSync('add_folder');
    }
  };

  btnConfirmNewFolder?.addEventListener('click', confirmNewFolder);
  newFolderInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter') confirmNewFolder();
    if (e.key === 'Escape' && newFolderInline) newFolderInline.style.display = 'none';
  });
  btnCancelNewFolder?.addEventListener('click', () => {
    if (newFolderInline) newFolderInline.style.display = 'none';
  });

  // 收藏夹抽屉渲染 (支持【地点】与【路线】双标签页)
  let currentFolderFilter = 'all';
  let currentFavTabMode = 'points'; // 'points' | 'routes'

  const favMainTabs = document.querySelectorAll('#fav-main-type-tabs .fav-main-tab');
  const favPtsContainer = document.getElementById('fav-points-container');
  const favRoutesContainer = document.getElementById('fav-routes-container');
  const favRoutesList = document.getElementById('fav-routes-list');
  const favPtsCount = document.getElementById('fav-pts-count');
  const favRoutesCount = document.getElementById('fav-routes-count');

  // 1. 收藏地点列表渲染
  const renderFavoritesList = () => {
    if (!favList) return;
    favList.innerHTML = '';
    if (favPtsCount) favPtsCount.innerText = savedWaypoints.length;

    const filtered = currentFolderFilter === 'all'
      ? savedWaypoints
      : savedWaypoints.filter(w => w.folder === currentFolderFilter);

    if (filtered.length === 0) {
      favList.innerHTML = `<div style="text-align:center; color:#94a3b8; padding:20px 0;">该文件夹下暂无收藏地点<br>可在右下角点击“选点”添加</div>`;
      return;
    }

    filtered.forEach(wp => {
      const item = document.createElement('div');
      item.className = 'fav-item-card';
      item.innerHTML = `
        <div class="fav-item-info">
          <div class="fav-item-name">${wp.name}</div>
          <div class="fav-item-meta">${wp.lng.toFixed(3)}°E, ${wp.lat.toFixed(3)}°N · ${wp.ele}m</div>
        </div>
        <button class="fav-item-del" title="删除该收藏">🗑️</button>
      `;

      item.querySelector('.fav-item-info').addEventListener('click', () => {
        const curPitch = isPitchLocked ? map.getPitch() : Math.min(map.getPitch() || 50, 52);
        const cameraCenter = calculateOffsetCameraCenter(map, [wp.lng, wp.lat], 14.2, curPitch, 0.67);
        map.flyTo({ center: cameraCenter, zoom: 14.2, pitch: curPitch, offset: [0, 0], duration: 1200 });
      });

      item.querySelector('.fav-item-del').addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`确定删除收藏点“${wp.name}”？`)) {
          savedWaypoints = savedWaypoints.filter(w => w.id !== wp.id);
          try {
            localStorage.setItem('outmap_saved_waypoints', JSON.stringify(savedWaypoints));
          } catch (err) {}
          renderWaypointMarkersOnMap();
          renderFavoritesList();
          if (typeof window.triggerRealtimeCloudSync === 'function') {
            window.triggerRealtimeCloudSync('delete_waypoint');
          }
        }
      });

      favList.appendChild(item);
    });
  };

  // 2. 收藏路线列表渲染
  const renderSavedRoutesList = () => {
    if (!favRoutesList) return;
    favRoutesList.innerHTML = '';
    if (favRoutesCount) favRoutesCount.innerText = savedRoutes.length;

    if (!savedRoutes || savedRoutes.length === 0) {
      favRoutesList.innerHTML = `<div style="text-align:center; color:#94a3b8; padding:30px 10px; font-size:12px; line-height:1.8;">暂无保存的路线<br>在“路线规划”面板中生成路线后<br>点击【💾 存路线】即可永久保存在此</div>`;
      return;
    }

    const modeNames = { drive: '🚗 自驾', cycle: '🚴 骑行', hike: '🥾 徒步' };

    savedRoutes.forEach((route) => {
      const card = document.createElement('div');
      card.className = 'fav-route-card';
      const m = route.metrics || {};
      const distStr = m.distKm ? `${m.distKm.toFixed(1)} km` : '-- km';
      const timeStr = m.timeStr ? `⏱ ${m.timeStr}` : '';
      const climbStr = m.ascent ? `▲ +${m.ascent}m` : '';
      const viaCount = route.viaPoints ? route.viaPoints.length : 0;
      const viaText = viaCount > 0 ? `途经点 ${viaCount}个` : '直达路线';

      card.innerHTML = `
        <div class="fav-route-header">
          <div class="fav-route-title-box">
            <span class="fav-route-mode-tag">${modeNames[route.mode] || '🛣️ 路线'}</span>
            <span class="fav-route-name" title="${route.name}">${route.name}</span>
          </div>
          <span class="fav-route-date">${route.createdAt || ''}</span>
        </div>
        <div class="fav-route-stats">
          <span>📏 ${distStr}</span>
          ${timeStr ? `<span>${timeStr}</span>` : ''}
          ${climbStr ? `<span>${climbStr}</span>` : ''}
          <span>📍 ${viaText}</span>
        </div>
        <div class="fav-route-actions">
          <button class="fav-route-btn primary btn-recall-route" title="在地图上调出并完整呈现该路线及三维高程剖面">⚡ 调出路线</button>
          <button class="fav-route-btn gpx btn-gpx-route" title="导出为标准 GPX 轨迹文件供手机/手持GPS使用">📥 导出GPX</button>
          <button class="fav-route-btn del btn-del-route" title="删除该路线">🗑️ 删除</button>
        </div>
      `;

      // 调出路线
      card.querySelector('.btn-recall-route').addEventListener('click', (e) => {
        e.stopPropagation();
        loadSavedRoute(route.id, map);
      });

      // 导出 GPX
      card.querySelector('.btn-gpx-route').addEventListener('click', (e) => {
        e.stopPropagation();
        exportRouteToGpx(route, map);
      });

      // 删除路线
      card.querySelector('.btn-del-route').addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`确定删除收藏路线“${route.name}”？`)) {
          savedRoutes = savedRoutes.filter(r => r.id !== route.id);
          try {
            localStorage.setItem('outmap_saved_routes', JSON.stringify(savedRoutes));
          } catch (err) {}
          renderSavedRoutesList();
          if (typeof window.triggerRealtimeCloudSync === 'function') {
            window.triggerRealtimeCloudSync('delete_route');
          }
        }
      });

      favRoutesList.appendChild(card);
    });
  };
  renderSavedRoutesListFn = renderSavedRoutesList;

  // 顶层 地点/路线 分类切换
  favMainTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      favMainTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentFavTabMode = tab.dataset.tab;
      if (currentFavTabMode === 'points') {
        if (favPtsContainer) favPtsContainer.style.display = 'block';
        if (favRoutesContainer) favRoutesContainer.style.display = 'none';
        renderFavoritesList();
      } else {
        if (favPtsContainer) favPtsContainer.style.display = 'none';
        if (favRoutesContainer) favRoutesContainer.style.display = 'block';
        renderSavedRoutesList();
      }
    });
  });

  const renderFolderTabs = () => {
    if (!favTabs) return;
    favTabs.innerHTML = '';
    const tabs = [
      { id: 'all', name: '全部' },
      { id: 'default', name: '⭐ 默认' },
      { id: 'camp', name: '⛺ 露营' },
      { id: 'hiking', name: '🥾 徒步' }
    ];
    customFolders.forEach(f => {
      tabs.push({ id: f.id, name: `📁 ${f.name}` });
    });

    tabs.forEach(t => {
      const btn = document.createElement('button');
      btn.className = 'fav-tab' + (t.id === currentFolderFilter ? ' active' : '');
      btn.innerText = t.name;
      btn.addEventListener('click', () => {
        currentFolderFilter = t.id;
        renderFolderTabs();
        renderFavoritesList();
      });
      favTabs.appendChild(btn);
    });
  };

  btnFabFav?.addEventListener('click', () => {
    const isHidden = favDrawer.style.display === 'none';
    if (isHidden) {
      closeConflictingBottomPanels('favorites-drawer');
      favDrawer.style.display = 'flex';
      renderFolderTabs();
      renderFavoritesList();
      renderSavedRoutesList();
    } else {
      favDrawer.style.display = 'none';
    }
  });

  btnCloseFav?.addEventListener('click', () => {
    favDrawer.style.display = 'none';
  });
}

// =========================================================
// 户外多途径点路线规划与三维海拔高程剖面系统 (Multi-Waypoint Route Engine)
// =========================================================
let routeStartCoord = null;
let routeStartName = '';
let routeStartMarker = null;

let routeEndCoord = null;
let routeEndName = '';
let routeEndMarker = null;

let routeViaPoints = []; // 存储途径点数组 [{ id, coords, name, marker }]
let isContinuousPicking = false; // 连续拾点模式开关
let pickingRoutePt = null; // 'start' | 'end' | 'via' | null
let activeRouteMode = 'drive'; // 'drive' | 'cycle' | 'hike'
let profileCursorMarker = null;
let currentProfileData = [];

// 计算两坐标之间大圆球面距离 (km)
function calculateDistanceKm(c1, c2) {
  const rad = Math.PI / 180;
  const dLat = (c2[1] - c1[1]) * rad;
  const dLng = (c2[0] - c1[0]) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(c1[1] * rad) * Math.cos(c2[1] * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

let currentOutdoorMap = null;
let draggedViaIndex = null;
let targetViaIndexForPick = null;

// 统一绑定起点、终点及途径点输入框的实时搜索、拼音联想与回车直达
function bindRoutePointInput(inputEl, dropdownEl, pointType, viaIndex = null, mapInstance = null) {
  if (!inputEl || !dropdownEl) return;
  const getMap = () => mapInstance || currentOutdoorMap;
  let searchTimer = null;
  let activeCandidates = [];

  const closeDropdown = () => {
    dropdownEl.style.display = 'none';
    dropdownEl.innerHTML = '';
    activeCandidates = [];
  };

  const triggerMapPick = () => {
    closeDropdown();
    const map = getMap();
    if (pointType === 'via') {
      targetViaIndexForPick = viaIndex;
      pickingRoutePt = 'via';
    } else {
      pickingRoutePt = pointType;
    }
    if (map) map.getCanvas().style.cursor = 'crosshair';
  };

  const selectCandidate = (item) => {
    inputEl.value = item.name;
    closeDropdown();
    const map = getMap();
    if (!map) return;

    if (pointType === 'start') {
      setRouteStartPoint(map, item.coords, item.name);
    } else if (pointType === 'end') {
      setRouteEndPoint(map, item.coords, item.name);
    } else if (pointType === 'via') {
      if (viaIndex !== null && routeViaPoints[viaIndex]) {
        const via = routeViaPoints[viaIndex];
        via.name = item.name;
        via.coords = item.coords;
        if (via.marker) {
          via.marker.setLngLat(item.coords);
        } else {
          const el = document.createElement('div');
          el.style.cssText = 'background:#0284c7; color:#fff; border-radius:50%; width:22px; height:22px; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:bold; border:2px solid #fff; box-shadow:0 2px 6px rgba(0,0,0,0.3); cursor:pointer;';
          el.innerText = viaIndex + 1;
          el.addEventListener('click', () => {
            map.flyTo({ center: item.coords, zoom: 15.0, offset: [0, 0], duration: 800, essential: true });
          });
          via.marker = new maplibregl.Marker({ element: el, anchor: 'center' })
            .setLngLat(item.coords)
            .addTo(map);
        }
        autoPlanMultiPointRoute(map);
      }
    }

    if (item.coords) {
      const currentZoom = map.getZoom();
      const minFlightZoom = Math.max(7.0, Math.min(currentZoom, 15.0) - 2.0);
      const targetPitch = isPitchLocked ? map.getPitch() : Math.min(map.getPitch() || 50, 52);
      const cameraCenter = calculateOffsetCameraCenter(map, item.coords, 15.0, targetPitch, 0.67);
      map.flyTo({
        center: cameraCenter,
        zoom: 15.0,
        pitch: targetPitch,
        offset: [0, 0],
        curve: 1.1,
        minZoom: minFlightZoom,
        duration: 1200,
        essential: true
      });
    }
  };

  const renderCandidates = (items, keyword) => {
    activeCandidates = items || [];
    dropdownEl.innerHTML = '';

    if (!items || items.length === 0) {
      dropdownEl.innerHTML = `
        <div class="route-search-empty">未找到“${keyword || ''}”，支持地名/拼音</div>
        <div class="route-search-item route-search-pick-map">
          <span class="route-search-item-icon">📍</span>
          <div class="route-search-item-info">
            <div class="route-search-item-name">在 3D 地图上点选</div>
            <div class="route-search-item-desc">点击后在地图上拾取该点坐标</div>
          </div>
        </div>
      `;
      const pickRow = dropdownEl.querySelector('.route-search-pick-map');
      pickRow?.addEventListener('click', (e) => {
        e.stopPropagation();
        triggerMapPick();
      });
    } else {
      items.forEach((item, idx) => {
        const cleanDesc = (item.desc || '目标地点')
          .replace(/^中国\s*[·,\-–]\s*/, '')
          .replace(/China\s*[·,\-–]\s*/i, '');
        const row = document.createElement('div');
        row.className = 'route-search-item' + (idx === 0 ? ' active' : '');
        row.innerHTML = `
          <span class="route-search-item-icon">${item.icon || '📍'}</span>
          <div class="route-search-item-info">
            <div class="route-search-item-name">${item.name}</div>
            <div class="route-search-item-desc">${cleanDesc}</div>
          </div>
        `;
        row.addEventListener('click', (e) => {
          e.stopPropagation();
          selectCandidate(item);
        });
        dropdownEl.appendChild(row);
      });

      const mapPickRow = document.createElement('div');
      mapPickRow.className = 'route-search-item route-search-pick-map';
      mapPickRow.innerHTML = `
        <span class="route-search-item-icon">📍</span>
        <div class="route-search-item-info">
          <div class="route-search-item-name">在 3D 地图上点选</div>
          <div class="route-search-item-desc">点击后在地图上拾取精确坐标</div>
        </div>
      `;
      mapPickRow.addEventListener('click', (e) => {
        e.stopPropagation();
        triggerMapPick();
      });
      dropdownEl.appendChild(mapPickRow);
    }
    dropdownEl.style.display = 'flex';
  };

  inputEl.addEventListener('input', () => {
    const val = (inputEl.value || '').trim();
    clearTimeout(searchTimer);
    if (!val) {
      closeDropdown();
      return;
    }
    searchTimer = setTimeout(async () => {
      const results = await queryLocationCandidates(val);
      renderCandidates(results, val);
    }, 180);
  });

  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (activeCandidates.length > 0) {
        selectCandidate(activeCandidates[0]);
      } else {
        const val = (inputEl.value || '').trim();
        if (val) {
          queryLocationCandidates(val).then(res => {
            if (res && res.length > 0) {
              selectCandidate(res[0]);
            } else {
              renderCandidates([], val);
            }
          });
        }
      }
    } else if (e.key === 'Escape') {
      closeDropdown();
    }
  });

  inputEl.addEventListener('focus', () => {
    const val = (inputEl.value || '').trim();
    if (val && dropdownEl.style.display === 'none') {
      queryLocationCandidates(val).then(res => renderCandidates(res, val));
    }
  });

  document.addEventListener('click', (e) => {
    if (!inputEl.contains(e.target) && !dropdownEl.contains(e.target)) {
      closeDropdown();
    }
  });
}

// 渲染途径点列表 (支持拼音/汉字回车搜索、地图定位、删除以及上下拖动手柄排序)
function renderViaList(mapInstance) {
  const map = mapInstance || currentOutdoorMap;
  const container = document.getElementById('route-via-list');
  if (!container) return;
  container.innerHTML = '';

  routeViaPoints.forEach((via, idx) => {
    const row = document.createElement('div');
    row.className = 'route-via-item';
    row.setAttribute('draggable', 'true');
    row.dataset.index = idx;

    row.innerHTML = `
      <span class="pt-tag via" title="途径点 ${idx + 1}">${idx + 1}</span>
      <div class="route-input-wrap">
        <input type="text" class="route-pt-input via-name-input" value="${via.name || ''}" placeholder="输入途径点 (支持拼音/汉字，回车搜索)..." autocomplete="off" />
        <div class="route-search-dropdown" style="display: none;"></div>
      </div>
      <button class="btn-via-del" title="删除该途径点">✕</button>
      <div class="btn-drag-handle via-drag-handle" title="按住上下拖动调整顺序" draggable="true">⠿</div>
    `;

    const inputEl = row.querySelector('.via-name-input');
    const dropdownEl = row.querySelector('.route-search-dropdown');
    const delBtn = row.querySelector('.btn-via-del');
    const dragHandle = row.querySelector('.via-drag-handle');
    const tagEl = row.querySelector('.pt-tag.via');

    if (tagEl && via.coords) {
      tagEl.style.cursor = 'pointer';
      tagEl.addEventListener('click', () => {
        if (map && via.coords) {
          map.flyTo({ center: via.coords, zoom: 13.5, duration: 1200 });
        }
      });
    }

    // 绑定途径点输入框的实时联想搜索与回车直达
    bindRoutePointInput(inputEl, dropdownEl, 'via', idx, map);

    // 删除该途径点
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeViaPoint(map, idx);
    });

    // 拖拽排序逻辑 (HTML5 Drag & Drop)
    row.addEventListener('dragstart', (e) => {
      if (document.activeElement === inputEl) {
        e.preventDefault();
        return;
      }
      draggedViaIndex = idx;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(idx));
      setTimeout(() => row.classList.add('dragging'), 0);
    });

    row.addEventListener('dragend', () => {
      row.classList.remove('dragging');
      container.querySelectorAll('.route-via-item').forEach(el => el.classList.remove('drag-over'));
      draggedViaIndex = null;
    });

    row.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      row.classList.add('drag-over');
    });

    row.addEventListener('dragleave', () => {
      row.classList.remove('drag-over');
    });

    row.addEventListener('drop', (e) => {
      e.preventDefault();
      row.classList.remove('drag-over');
      if (draggedViaIndex !== null && draggedViaIndex !== idx) {
        const [moved] = routeViaPoints.splice(draggedViaIndex, 1);
        routeViaPoints.splice(idx, 0, moved);
        // 更新所有途径点 marker 上的数字
        routeViaPoints.forEach((v, i) => {
          if (v.marker && v.marker.getElement()) {
            v.marker.getElement().innerText = i + 1;
          }
        });
        renderViaList(map);
        autoPlanMultiPointRoute(map);
      }
      draggedViaIndex = null;
    });

    // Touch 移动端触摸拖动支持
    dragHandle.addEventListener('touchstart', () => {
      draggedViaIndex = idx;
      row.classList.add('dragging');
    }, { passive: true });

    dragHandle.addEventListener('touchmove', (e) => {
      const touch = e.touches[0];
      const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
      const targetRow = targetEl?.closest('.route-via-item');
      container.querySelectorAll('.route-via-item').forEach(el => el.classList.remove('drag-over'));
      if (targetRow && targetRow !== row) {
        targetRow.classList.add('drag-over');
      }
    }, { passive: true });

    dragHandle.addEventListener('touchend', (e) => {
      row.classList.remove('dragging');
      const touch = e.changedTouches[0];
      const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
      const targetRow = targetEl?.closest('.route-via-item');
      container.querySelectorAll('.route-via-item').forEach(el => el.classList.remove('drag-over'));
      if (targetRow && targetRow.dataset.index !== undefined) {
        const toIndex = parseInt(targetRow.dataset.index, 10);
        if (!isNaN(toIndex) && toIndex !== idx) {
          const [moved] = routeViaPoints.splice(idx, 1);
          routeViaPoints.splice(toIndex, 0, moved);
          routeViaPoints.forEach((v, i) => {
            if (v.marker && v.marker.getElement()) {
              v.marker.getElement().innerText = i + 1;
            }
          });
          renderViaList(map);
          autoPlanMultiPointRoute(map);
        }
      }
      draggedViaIndex = null;
    });

    container.appendChild(row);
  });
}

// 添加途径点并自动刷新规划
function addViaPoint(map, coords, label) {
  const m = map || currentOutdoorMap;
  const idx = routeViaPoints.length + 1;
  let marker = null;
  if (coords && m) {
    const el = document.createElement('div');
    el.style.cssText = 'background:#0284c7; color:#fff; border-radius:50%; width:22px; height:22px; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:bold; border:2px solid #fff; box-shadow:0 2px 6px rgba(0,0,0,0.3); cursor:pointer;';
    el.innerText = idx;
    el.addEventListener('click', () => {
      const curPitch = m.getPitch() || 50;
      const cameraCenter = calculateOffsetCameraCenter(m, coords, 15.0, curPitch, 0.67);
      m.flyTo({ center: cameraCenter, zoom: 15.0, pitch: curPitch, offset: [0, 0], duration: 800, essential: true });
    });

    marker = new maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat(coords)
      .addTo(m);
  }

  const viaName = label || (coords ? `途径点 ${idx} (${coords[0].toFixed(3)}°, ${coords[1].toFixed(3)}°)` : '');
  routeViaPoints.push({
    id: 'via_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    coords,
    name: viaName,
    marker
  });

  renderViaList(m);
  closeConflictingBottomPanels('route-panel');
  const routePanel = document.getElementById('route-panel');
  if (routePanel) routePanel.style.display = 'flex';

  if (coords && m) {
    autoPlanMultiPointRoute(m);
  }
}

// 移除特定途径点并重新编排序号
function removeViaPoint(map, index) {
  const m = map || currentOutdoorMap;
  if (index >= 0 && index < routeViaPoints.length) {
    if (routeViaPoints[index].marker) {
      routeViaPoints[index].marker.remove();
    }
    routeViaPoints.splice(index, 1);

    // 重新排序更新途径点标签序号
    routeViaPoints.forEach((v, i) => {
      if (v.marker && v.marker.getElement()) {
        v.marker.getElement().innerText = i + 1;
      }
    });

    renderViaList(m);
    if (m) autoPlanMultiPointRoute(m);
  }
}

// 设置起点
function setRouteStartPoint(map, coords, label) {
  const m = map || currentOutdoorMap;
  routeStartCoord = coords;
  routeStartName = label || `起点 (${coords[0].toFixed(3)}°, ${coords[1].toFixed(3)}°)`;
  const startInput = document.getElementById('route-start-input');
  const routePanel = document.getElementById('route-panel');
  if (startInput) startInput.value = routeStartName;
  if (routeStartMarker) routeStartMarker.remove();
  const el = document.createElement('div');
  el.style.cssText = 'background:#16a34a; color:#fff; border-radius:50%; width:24px; height:24px; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:bold; border:2px solid #fff; box-shadow:0 2px 6px rgba(0,0,0,0.3); cursor:pointer;';
  el.innerText = '起';
  el.addEventListener('click', () => {
    if (m) {
      const curPitch = m.getPitch() || 50;
      const cameraCenter = calculateOffsetCameraCenter(m, coords, 15.0, curPitch, 0.67);
      m.flyTo({ center: cameraCenter, zoom: 15.0, pitch: curPitch, offset: [0, 0], duration: 800, essential: true });
    }
  });
  if (m) {
    routeStartMarker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(coords).addTo(m);
  }
  closeConflictingBottomPanels('route-panel');
  if (routePanel) routePanel.style.display = 'flex';
  if (m) autoPlanMultiPointRoute(m);
}

// 设置终点
function setRouteEndPoint(map, coords, label) {
  const m = map || currentOutdoorMap;
  routeEndCoord = coords;
  routeEndName = label || `终点 (${coords[0].toFixed(3)}°, ${coords[1].toFixed(3)}°)`;
  const endInput = document.getElementById('route-end-input');
  const routePanel = document.getElementById('route-panel');
  if (endInput) endInput.value = routeEndName;
  if (routeEndMarker) routeEndMarker.remove();
  const el = document.createElement('div');
  el.style.cssText = 'background:#ef4444; color:#fff; border-radius:50%; width:24px; height:24px; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:bold; border:2px solid #fff; box-shadow:0 2px 6px rgba(0,0,0,0.3); cursor:pointer;';
  el.innerText = '终';
  el.addEventListener('click', () => {
    if (m) {
      const curPitch = m.getPitch() || 50;
      const cameraCenter = calculateOffsetCameraCenter(m, coords, 15.0, curPitch, 0.67);
      m.flyTo({ center: cameraCenter, zoom: 15.0, pitch: curPitch, offset: [0, 0], duration: 800, essential: true });
    }
  });
  if (m) {
    routeEndMarker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(coords).addTo(m);
  }
  closeConflictingBottomPanels('route-panel');
  if (routePanel) routePanel.style.display = 'flex';
  if (m) autoPlanMultiPointRoute(m);
}

// 核心自动化多途径点规划与海拔剖面解算引擎
let currentRouteRequestId = 0;

function renderRouteGeometry(map, pathCoords) {
  const routeGeojson = {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: pathCoords
    }
  };

  if (map.getSource('outdoor-route-source')) {
    map.getSource('outdoor-route-source').setData(routeGeojson);
  } else {
    map.addSource('outdoor-route-source', {
      type: 'geojson',
      data: routeGeojson
    });

    // 1. 底层高对比柔白轮廓外壳 (在黄/橙色国道省道、高速公路与卫星底图上形成清晰隔离带，彻底杜绝重合混淆)
    map.addLayer({
      id: 'outdoor-route-casing',
      type: 'line',
      source: 'outdoor-route-source',
      layout: {
        'line-cap': 'round',
        'line-join': 'round'
      },
      paint: {
        'line-color': '#ffffff',
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 5.0, 10, 7.5, 14, 10.5],
        'line-opacity': 0.98
      }
    });

    // 2. 中层紫霞光晕 (赋予清晰立体的高级夜光浮空轨迹质感)
    map.addLayer({
      id: 'outdoor-route-glow',
      type: 'line',
      source: 'outdoor-route-source',
      layout: {
        'line-cap': 'round',
        'line-join': 'round'
      },
      paint: {
        'line-color': '#7c3aed',
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 6.5, 10, 10.0, 14, 14.5],
        'line-opacity': 0.32,
        'line-blur': 2.0
      }
    });

    // 3. 顶层户外高对比电光紫核心带 (与橙/黄国道省道、蓝水系、绿地表形成 100% 互补高对比，清晰显眼且不突兀)
    map.addLayer({
      id: 'outdoor-route-line',
      type: 'line',
      source: 'outdoor-route-source',
      layout: {
        'line-cap': 'round',
        'line-join': 'round'
      },
      paint: {
        'line-color': '#7c3aed',
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 2.8, 10, 4.2, 14, 6.2],
        'line-opacity': 1.0
      }
    });

    // 4. 内部晶莹高亮线 (营造微发光通透悬浮感)
    map.addLayer({
      id: 'outdoor-route-inner-core',
      type: 'line',
      source: 'outdoor-route-source',
      layout: {
        'line-cap': 'round',
        'line-join': 'round'
      },
      paint: {
        'line-color': '#f5f3ff',
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1.0, 10, 1.5, 14, 2.2],
        'line-opacity': 0.9
      }
    });
  }
}

function updateProfileAndMetrics(map, pathCoords, roadDistanceKm, roadDurationSec, isRealRoad, shouldFitBounds) {
  const statsBox = document.getElementById('route-stats-box');
  const chartSection = document.getElementById('route-chart-section');
  const distEl = document.getElementById('stat-route-dist');
  const timeEl = document.getElementById('stat-route-time');
  const ascentEl = document.getElementById('stat-route-ascent');
  const descentEl = document.getElementById('stat-route-descent');
  const maxEleEl = document.getElementById('stat-route-maxele');
  const minEleEl = document.getElementById('stat-route-minele');
  const canvas = document.getElementById('elevation-chart-canvas');

  const sampleStep = Math.max(1, Math.floor(pathCoords.length / 280));
  const sampledCoords = [];
  for (let i = 0; i < pathCoords.length; i += sampleStep) {
    sampledCoords.push(pathCoords[i]);
  }
  if (sampledCoords[sampledCoords.length - 1] !== pathCoords[pathCoords.length - 1]) {
    sampledCoords.push(pathCoords[pathCoords.length - 1]);
  }

  let totalDistKm = 0;
  let totalAscent = 0;
  let totalDescent = 0;
  let maxEle = -9999;
  let minEle = 99999;
  currentProfileData = [];

  for (let i = 0; i < sampledCoords.length; i++) {
    const pt = sampledCoords[i];
    let ele = getRealElevation(map, pt);
    if (ele === null || ele === undefined) {
      ele = 500 + Math.sin((i / sampledCoords.length) * Math.PI) * 2600;
    }
    ele = Math.round(ele);

    if (i > 0) {
      const prev = sampledCoords[i - 1];
      const d = calculateDistanceKm(prev, pt);
      totalDistKm += d;

      const prevEle = currentProfileData[i - 1].ele;
      const diff = ele - prevEle;
      if (diff > 0) totalAscent += diff;
      else totalDescent += Math.abs(diff);
    }

    if (ele > maxEle) maxEle = ele;
    if (ele < minEle) minEle = ele;

    currentProfileData.push({ distKm: totalDistKm, ele, coord: pt });
  }

  if (roadDistanceKm && roadDistanceKm > 0) {
    totalDistKm = roadDistanceKm;
  }

  let timeStr = '';
  if (roadDurationSec && roadDurationSec > 0) {
    const hrs = roadDurationSec / 3600;
    if (hrs < 1) {
      timeStr = `${Math.round(roadDurationSec / 60)}分钟`;
    } else {
      timeStr = `${Math.floor(hrs)}小时${Math.round((hrs % 1) * 60)}分`;
    }
  } else if (activeRouteMode === 'drive') {
    const hrs = totalDistKm / 48;
    timeStr = `${Math.floor(hrs)}小时${Math.round((hrs % 1) * 60)}分`;
  } else if (activeRouteMode === 'cycle') {
    const hrs = (totalDistKm / 16) + (totalAscent / 700);
    timeStr = `${Math.floor(hrs)}小时${Math.round((hrs % 1) * 60)}分`;
  } else {
    const hrs = (totalDistKm / 4.2) + (totalAscent / 450);
    timeStr = `${Math.floor(hrs)}小时${Math.round((hrs % 1) * 60)}分`;
  }

  if (distEl) distEl.innerText = `${totalDistKm.toFixed(1)} km${isRealRoad ? '' : ' (导引)'}`;
  if (timeEl) timeEl.innerText = timeStr;
  if (ascentEl) ascentEl.innerText = `+${Math.round(totalAscent)} m`;
  if (descentEl) descentEl.innerText = `-${Math.round(totalDescent)} m`;
  if (maxEleEl) maxEleEl.innerText = `${maxEle} m`;
  if (minEleEl) minEleEl.innerText = `${minEle} m`;

  currentPlannedRouteCoords = pathCoords;
  currentRouteMetrics = {
    totalDistKm,
    timeStr,
    totalAscent,
    totalDescent,
    maxEle,
    minEle,
    isRealRoad
  };

  // 海拔剖面图默认隐藏 (桌面与浏览器端均遵循，点击详情内海拔信息时才滑出)
  if (chartSection && chartSection.style.display !== 'none') {
    drawElevationChart(canvas, currentProfileData);
  }

  if (shouldFitBounds && pathCoords.length > 0) {
    const bounds = pathCoords.reduce((b, c) => b.extend(c), new maplibregl.LngLatBounds(pathCoords[0], pathCoords[0]));
    map.fitBounds(bounds, { padding: 90, pitch: 58, bearing: 20, duration: 1800 });
  }
}

async function autoPlanMultiPointRoute(mapInstance, shouldFitBounds = false) {
  const map = mapInstance || currentOutdoorMap;
  if (!map) return;
  const reqId = ++currentRouteRequestId;
  const ordered = [];
  if (routeStartCoord) ordered.push({ coords: routeStartCoord, role: 'start', name: routeStartName });
  routeViaPoints.forEach((v, i) => {
    if (v && v.coords) {
      ordered.push({ coords: v.coords, role: 'via', name: v.name, index: i + 1 });
    }
  });
  if (routeEndCoord) ordered.push({ coords: routeEndCoord, role: 'end', name: routeEndName });

  const statsBox = document.getElementById('route-stats-box');
  const chartSection = document.getElementById('route-chart-section');
  const distEl = document.getElementById('stat-route-dist');

  // 若有效节点少于 2 个，清空高亮轨迹和剖面
  if (ordered.length < 2) {
    if (map.getSource('outdoor-route-source')) {
      map.getSource('outdoor-route-source').setData({ type: 'FeatureCollection', features: [] });
    }
    if (statsBox) statsBox.style.display = 'none';
    if (chartSection) chartSection.style.display = 'none';
    currentProfileData = [];
    return;
  }

  // 1. 【即时乐观渲染机制 (0ms 零等待)】立即生成贴合地形的连续导引线并秒显剖面，彻底杜绝网络等待或引擎假死
  const initialPathCoords = [];
  for (let s = 0; s < ordered.length - 1; s++) {
    const pA = ordered[s].coords;
    const pB = ordered[s + 1].coords;
    const distSegmentKm = calculateDistanceKm(pA, pB);
    const subSteps = Math.max(5, Math.min(25, Math.round(distSegmentKm / 0.5)));

    for (let k = 0; k < subSteps; k++) {
      const t = k / subSteps;
      const curLng = pA[0] + (pB[0] - pA[0]) * t;
      const curLat = pA[1] + (pB[1] - pA[1]) * t;
      initialPathCoords.push([curLng, curLat]);
    }
  }
  initialPathCoords.push(ordered[ordered.length - 1].coords);

  // 瞬间上图并展现指标
  renderRouteGeometry(map, initialPathCoords);
  updateProfileAndMetrics(map, initialPathCoords, null, null, false, shouldFitBounds);

  if (distEl) {
    distEl.innerText = `${distEl.innerText.replace(' (导引)', '')} (路网匹配中...)`;
  }

  // 2. 【后台静默路网吸附】优先请求本机离线路网与持久缓存，成功后平滑就地升级
  (async () => {
    try {
      const profile = activeRouteMode === 'cycle' ? 'bike' : (activeRouteMode === 'hike' ? 'foot' : 'driving');
      const coordStr = ordered.map(p => `${p.coords[0].toFixed(5)},${p.coords[1].toFixed(5)}`).join(';');
      const localRouteUrl = `http://127.0.0.1:${localServerPort}/route/v1/${profile}/${coordStr}?overview=full&geometries=geojson`;

      let resp = null;
      try {
        resp = await fetch(localRouteUrl, { signal: AbortSignal.timeout(3200) });
      } catch (localErr) {
        resp = await fetch(`https://router.project-osrm.org/route/v1/${profile}/${coordStr}?overview=full&geometries=geojson`, { signal: AbortSignal.timeout(3200) });
      }

      if (resp && resp.ok) {
        const data = await resp.json();
        if (reqId === currentRouteRequestId && data.code === 'Ok' && data.routes && data.routes[0]) {
          const roadCoords = data.routes[0].geometry.coordinates;
          const roadDistanceKm = data.routes[0].distance / 1000;
          const roadDurationSec = data.routes[0].duration;

          renderRouteGeometry(map, roadCoords);
          updateProfileAndMetrics(map, roadCoords, roadDistanceKm, roadDurationSec, true, false);
        }
      }
    } catch (e) {
      // 离线或超时时，初始导引路线已在地图上完整呈现，移除加载标记即可
      if (reqId === currentRouteRequestId && distEl) {
        distEl.innerText = distEl.innerText.replace(' (路网匹配中...)', ' (导引)');
      }
    }
  })();
}

function setupOutdoorRouteSystem(map) {
  const btnFabRoute = document.getElementById('btn-fab-route');
  const routePanel = document.getElementById('route-panel');
  const btnCloseRoute = document.getElementById('btn-close-route-panel');
  const startInput = document.getElementById('route-start-input');
  const endInput = document.getElementById('route-end-input');
  const startDropdown = document.getElementById('route-start-dropdown');
  const endDropdown = document.getElementById('route-end-dropdown');
  const btnAddViaPoint = document.getElementById('btn-add-via-point');
  const btnContinuousPick = document.getElementById('btn-continuous-pick');
  const btnCalcRoute = document.getElementById('btn-calc-route');
  const btnClearRoute = document.getElementById('btn-clear-route');

  // 导出下拉与详情折叠按钮
  const btnRouteExportTrigger = document.getElementById('btn-route-export-trigger');
  const routeExportMenu = document.getElementById('route-export-menu');
  const btnRouteDetailsToggle = document.getElementById('btn-route-details-toggle');
  const btnSaveRoute = document.getElementById('btn-save-route');
  const btnExportGpx = document.getElementById('btn-export-gpx');

  const statsBox = document.getElementById('route-stats-box');
  const chartSection = document.getElementById('route-chart-section');
  const canvas = document.getElementById('elevation-chart-canvas');
  const chartHoverInfo = document.getElementById('chart-hover-info');

  btnFabRoute?.addEventListener('click', () => {
    const isHidden = routePanel.style.display === 'none';
    if (isHidden) {
      closeConflictingBottomPanels('route-panel');
      routePanel.style.display = 'flex';
    } else {
      routePanel.style.display = 'none';
    }
  });

  btnCloseRoute?.addEventListener('click', () => {
    routePanel.style.display = 'none';
    if (startDropdown) startDropdown.style.display = 'none';
    if (endDropdown) endDropdown.style.display = 'none';
    if (routeExportMenu) routeExportMenu.style.display = 'none';
  });

  // 出行方式切换 (自驾、骑行、徒步)
  document.querySelectorAll('.route-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.route-mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeRouteMode = btn.getAttribute('data-mode');
      autoPlanMultiPointRoute(map);
    });
  });

  // 开启 / 退出连续拾点模式 (地表连续点击自动延伸规划数十个点)
  const toggleContinuousPick = (forceState) => {
    isContinuousPicking = (typeof forceState === 'boolean') ? forceState : !isContinuousPicking;
    if (btnContinuousPick) {
      btnContinuousPick.classList.toggle('active', isContinuousPicking);
      const span = btnContinuousPick.querySelector('span:last-child');
      if (span) {
        span.innerText = isContinuousPicking ? '正在连续拾点 (点击地表)...' : '⚡ 地图连续拾点';
      }
    }
    map.getCanvas().style.cursor = isContinuousPicking ? 'crosshair' : '';
  };

  btnContinuousPick?.addEventListener('click', () => {
    toggleContinuousPick();
  });

  currentOutdoorMap = map;

  // 单次添加一个途径点：插入新途径点并自动聚焦其输入框
  btnAddViaPoint?.addEventListener('click', () => {
    addViaPoint(map, null, '');
    const container = document.getElementById('route-via-list');
    if (container) {
      const lastInput = container.querySelector('.route-via-item:last-child .via-name-input');
      if (lastInput) {
        lastInput.focus();
      }
    }
  });

  // 绑定起点与终点输入框 (支持拼音/汉字联想及回车直达)
  bindRoutePointInput(startInput, startDropdown, 'start', null, map);
  bindRoutePointInput(endInput, endDropdown, 'end', null, map);

  // 对调起终点按钮绑定 (点击 ⇅ 键对调起终点并反转途径点)
  const swapStartAndEndRoutePoints = () => {
    const tCoord = routeStartCoord;
    const tName = routeStartName;
    const tMarker = routeStartMarker;

    routeStartCoord = routeEndCoord;
    routeStartName = routeEndName;
    routeStartMarker = routeEndMarker;

    routeEndCoord = tCoord;
    routeEndName = tName;
    routeEndMarker = tMarker;

    if (startInput) startInput.value = routeStartName || '';
    if (endInput) endInput.value = routeEndName || '';

    // 更新地图上的 marker 标识与色彩 (起=绿，终=红)
    if (routeStartMarker && routeStartMarker.getElement()) {
      routeStartMarker.getElement().style.background = '#16a34a';
      routeStartMarker.getElement().innerText = '起';
    }
    if (routeEndMarker && routeEndMarker.getElement()) {
      routeEndMarker.getElement().style.background = '#ef4444';
      routeEndMarker.getElement().innerText = '终';
    }

    // 途径点顺序倒转 (返程)
    if (routeViaPoints && routeViaPoints.length > 1) {
      routeViaPoints.reverse();
      routeViaPoints.forEach((v, i) => {
        if (v.marker && v.marker.getElement()) {
          v.marker.getElement().innerText = i + 1;
        }
      });
    }

    renderViaList(map);
    autoPlanMultiPointRoute(map);
  };

  document.getElementById('btn-swap-route-pts')?.addEventListener('click', swapStartAndEndRoutePoints);
  document.getElementById('btn-swap-route-pts-2')?.addEventListener('click', swapStartAndEndRoutePoints);

  // 地图点击：智能响应连续拾点模式与单点模式
  map.on('click', e => {
    const { lng, lat } = e.lngLat;
    const cleanLocation = resolveLocationInfo(map, e.lngLat, e.point, true);

    // 1. 连续拾点模式：每次点击地表，自动向后追加途径点并实时刷新高程剖面
    if (isContinuousPicking) {
      if (!routeStartCoord) {
        setRouteStartPoint(map, [lng, lat], cleanLocation || '起点');
      } else if (!routeEndCoord) {
        setRouteEndPoint(map, [lng, lat], cleanLocation || '终点');
      } else {
        const oldEndCoord = routeEndCoord;
        const oldEndName = routeEndName;
        addViaPoint(map, oldEndCoord, oldEndName || `途径点 ${routeViaPoints.length + 1}`);
        setRouteEndPoint(map, [lng, lat], cleanLocation || '终点');
      }
      return;
    }

    // 2. 单点拾取模式
    if (!pickingRoutePt) return;
    map.getCanvas().style.cursor = '';

    if (pickingRoutePt === 'start') {
      setRouteStartPoint(map, [lng, lat], cleanLocation || '起点');
    } else if (pickingRoutePt === 'end') {
      setRouteEndPoint(map, [lng, lat], cleanLocation || '终点');
    } else if (pickingRoutePt === 'via') {
      if (targetViaIndexForPick !== null && routeViaPoints[targetViaIndexForPick]) {
        const v = routeViaPoints[targetViaIndexForPick];
        v.coords = [lng, lat];
        v.name = cleanLocation || `途径点 ${targetViaIndexForPick + 1}`;
        if (v.marker) {
          v.marker.setLngLat([lng, lat]);
        } else {
          const el = document.createElement('div');
          el.style.cssText = 'background:#0284c7; color:#fff; border-radius:50%; width:22px; height:22px; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:bold; border:2px solid #fff; box-shadow:0 2px 6px rgba(0,0,0,0.3); cursor:pointer;';
          el.innerText = targetViaIndexForPick + 1;
          el.addEventListener('click', () => {
            const curPitch = map.getPitch() || 50;
            const cameraCenter = calculateOffsetCameraCenter(map, [lng, lat], 15.0, curPitch, 0.67);
            map.flyTo({ center: cameraCenter, zoom: 15.0, pitch: curPitch, offset: [0, 0], duration: 800, essential: true });
          });
          v.marker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([lng, lat]).addTo(map);
        }
        renderViaList(map);
        autoPlanMultiPointRoute(map);
      } else {
        addViaPoint(map, [lng, lat], cleanLocation || `途径点 ${routeViaPoints.length + 1}`);
      }
      targetViaIndexForPick = null;
      if (btnAddViaPoint) btnAddViaPoint.innerHTML = '<span>➕ 添加途径点</span>';
    }
    pickingRoutePt = null;
  });

  // 1. 规划按钮 (无⚡图标)
  btnCalcRoute?.addEventListener('click', () => {
    if (!routeStartCoord || !routeEndCoord) {
      if (!routeStartCoord && !routeEndCoord) {
        setRouteStartPoint(map, [104.0668, 30.5728], '成都市 (西岭门户)');
        addViaPoint(map, [103.6210, 31.0020], '都江堰 (紫坪铺水库)');
        addViaPoint(map, [103.1250, 31.0260], '卧龙巴朗山垭口 (4481m)');
        setRouteEndPoint(map, [102.8360, 30.9980], '四姑娘山镇 (蜀山之后)');
      } else {
        alert('请先设定完整的起点和终点！');
        return;
      }
    }
    autoPlanMultiPointRoute(map, true);
  });

  // 2. 导出下拉菜单切换 (存到收藏夹、导出GPX)
  btnRouteExportTrigger?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!routeExportMenu) return;
    const isShown = routeExportMenu.style.display !== 'none';
    routeExportMenu.style.display = isShown ? 'none' : 'flex';
  });

  // 3. 详情切换按钮 (展开/收起 距离与海拔等详情)
  btnRouteDetailsToggle?.addEventListener('click', () => {
    if (!statsBox) return;
    const isHidden = statsBox.style.display === 'none';
    statsBox.style.display = isHidden ? 'grid' : 'none';
    btnRouteDetailsToggle.innerText = isHidden ? '收起' : '详情 ▾';
  });

  // 4. 海拔变化图交互联动：海拔图默认彻底隐藏，点击详情中海拔指标时才展开
  const toggleElevationChart = () => {
    if (!chartSection) return;
    const isHidden = chartSection.style.display === 'none';
    if (isHidden) {
      chartSection.style.display = 'flex';
      drawElevationChart(canvas, currentProfileData);
    } else {
      chartSection.style.display = 'none';
    }
  };

  document.getElementById('stat-card-ascent')?.addEventListener('click', toggleElevationChart);
  document.getElementById('stat-card-descent')?.addEventListener('click', toggleElevationChart);
  document.getElementById('stat-card-maxele')?.addEventListener('click', toggleElevationChart);
  document.getElementById('stat-card-minele')?.addEventListener('click', toggleElevationChart);
  document.getElementById('stat-toggle-chart-btn')?.addEventListener('click', toggleElevationChart);

  // 5. 点击页面空白或地图自动关闭下拉菜单
  document.addEventListener('click', (e) => {
    if (routeExportMenu && !routeExportMenu.contains(e.target) && e.target !== btnRouteExportTrigger) {
      routeExportMenu.style.display = 'none';
    }
    if (startDropdown && !startDropdown.contains(e.target) && e.target !== startInput) {
      startDropdown.style.display = 'none';
    }
    if (endDropdown && !endDropdown.contains(e.target) && e.target !== endInput) {
      endDropdown.style.display = 'none';
    }
  });

  // 清空所有点与路线
  btnClearRoute?.addEventListener('click', () => {
    if (map.getSource('outdoor-route-source')) {
      map.getSource('outdoor-route-source').setData({ type: 'FeatureCollection', features: [] });
    }
    if (routeStartMarker) routeStartMarker.remove();
    if (routeEndMarker) routeEndMarker.remove();
    if (profileCursorMarker) profileCursorMarker.remove();
    routeViaPoints.forEach(v => {
      if (v.marker) v.marker.remove();
    });
    routeViaPoints = [];
    routeStartCoord = null;
    routeStartName = '';
    routeStartMarker = null;
    routeEndCoord = null;
    routeEndName = '';
    routeEndMarker = null;

    toggleContinuousPick(false);

    if (startInput) startInput.value = '';
    if (endInput) endInput.value = '';
    if (startDropdown) startDropdown.style.display = 'none';
    if (endDropdown) endDropdown.style.display = 'none';
    if (routeExportMenu) routeExportMenu.style.display = 'none';
    if (btnRouteDetailsToggle) btnRouteDetailsToggle.innerText = '详情 ▾';
    renderViaList(map);

    if (statsBox) statsBox.style.display = 'none';
    if (chartSection) chartSection.style.display = 'none';
    currentPlannedRouteCoords = [];
    currentProfileData = [];
    currentRouteMetrics = null;
  });

  // 路线保存与 GPX 导出处理
  const saveRouteModal = document.getElementById('save-route-modal');
  const btnCloseSaveRouteModal = document.getElementById('btn-close-save-route-modal');
  const btnCancelSaveRoute = document.getElementById('btn-cancel-save-route');
  const btnConfirmSaveRoute = document.getElementById('btn-confirm-save-route');
  const saveRouteNameInput = document.getElementById('save-route-name-input');
  const saveRouteDistText = document.getElementById('save-route-dist-text');
  const saveRouteAscentText = document.getElementById('save-route-ascent-text');

  // 点击【💾 存路线】
  btnSaveRoute?.addEventListener('click', () => {
    if (routeExportMenu) routeExportMenu.style.display = 'none';
    if (!routeStartCoord || !routeEndCoord || !currentPlannedRouteCoords || currentPlannedRouteCoords.length === 0) {
      alert('请先在地图上设定起点和终点，生成路线后再保存！');
      return;
    }
    const modeNames = { drive: '自驾', cycle: '骑行', hike: '徒步' };
    const defaultName = `${routeStartName || '起点'} 至 ${routeEndName || '终点'} (${modeNames[activeRouteMode] || '户外'})`;
    if (saveRouteNameInput) saveRouteNameInput.value = defaultName;
    if (saveRouteDistText && currentRouteMetrics) {
      saveRouteDistText.innerText = `${currentRouteMetrics.totalDistKm.toFixed(1)} km`;
    }
    if (saveRouteAscentText && currentRouteMetrics) {
      saveRouteAscentText.innerText = `+${Math.round(currentRouteMetrics.totalAscent)} m`;
    }
    if (saveRouteModal) saveRouteModal.style.display = 'block';
    if (saveRouteNameInput) {
      saveRouteNameInput.focus();
      saveRouteNameInput.select();
    }
  });

  const closeSaveModal = () => {
    if (saveRouteModal) saveRouteModal.style.display = 'none';
  };
  btnCloseSaveRouteModal?.addEventListener('click', closeSaveModal);
  btnCancelSaveRoute?.addEventListener('click', closeSaveModal);

  // 确认保存路线到收藏夹
  btnConfirmSaveRoute?.addEventListener('click', () => {
    const routeName = (saveRouteNameInput?.value || '').trim() || '规划路线';
    const newRoute = {
      id: 'route_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      name: routeName,
      mode: activeRouteMode,
      createdAt: new Date().toLocaleDateString('zh-CN'),
      timestamp: Date.now(),
      start: { coords: routeStartCoord, name: routeStartName || '起点' },
      end: { coords: routeEndCoord, name: routeEndName || '终点' },
      viaPoints: routeViaPoints.map(v => ({ coords: v.coords, name: v.name })),
      pathCoords: currentPlannedRouteCoords,
      metrics: {
        distKm: currentRouteMetrics ? currentRouteMetrics.totalDistKm : 0,
        timeStr: currentRouteMetrics ? currentRouteMetrics.timeStr : '',
        ascent: currentRouteMetrics ? Math.round(currentRouteMetrics.totalAscent) : 0,
        descent: currentRouteMetrics ? Math.round(currentRouteMetrics.totalDescent) : 0,
        maxEle: currentRouteMetrics ? currentRouteMetrics.maxEle : 0,
        minEle: currentRouteMetrics ? currentRouteMetrics.minEle : 0
      }
    };

    savedRoutes.unshift(newRoute);
    try {
      localStorage.setItem('outmap_saved_routes', JSON.stringify(savedRoutes));
    } catch (e) {}

    closeSaveModal();
    if (typeof renderSavedRoutesListFn === 'function') {
      renderSavedRoutesListFn();
    }
    if (typeof window.triggerRealtimeCloudSync === 'function') {
      window.triggerRealtimeCloudSync('save_route');
    }
    alert(`✅ 路线“${routeName}”已成功保存到收藏夹！\n可在右下角“⭐ 收藏”中随时调出或导出 GPX。`);
  });

  // 点击【📥 导出GPX】(当前规划路线)
  btnExportGpx?.addEventListener('click', () => {
    if (routeExportMenu) routeExportMenu.style.display = 'none';
    if (!routeStartCoord || !routeEndCoord || !currentPlannedRouteCoords || currentPlannedRouteCoords.length === 0) {
      alert('请先设定起点和终点并生成路线后再导出 GPX！');
      return;
    }
    const modeNames = { drive: '自驾', cycle: '骑行', hike: '徒步' };
    const currentRouteObj = {
      name: `${routeStartName || '起点'}_至_${routeEndName || '终点'}_${modeNames[activeRouteMode] || '路线'}`,
      mode: activeRouteMode,
      start: { coords: routeStartCoord, name: routeStartName },
      end: { coords: routeEndCoord, name: routeEndName },
      viaPoints: routeViaPoints.map(v => ({ coords: v.coords, name: v.name })),
      pathCoords: currentPlannedRouteCoords
    };
    exportRouteToGpx(currentRouteObj, map);
  });

  // Canvas 鼠标滑过联动 3D 地图
  if (canvas) {
    const handleProfileHover = (clientX) => {
      if (currentProfileData.length === 0) return;
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, x / rect.width));
      const idx = Math.round(ratio * (currentProfileData.length - 1));
      const pt = currentProfileData[idx];
      if (!pt) return;

      if (chartHoverInfo) {
        chartHoverInfo.innerText = `${pt.distKm.toFixed(1)}km · 海拔 ${pt.ele}m`;
      }

      // 联动 3D 地图光标
      if (!profileCursorMarker) {
        const el = document.createElement('div');
        el.style.cssText = 'background:#f97316; width:16px; height:16px; border-radius:50%; border:3px solid #fff; box-shadow:0 0 10px #ea580c;';
        profileCursorMarker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(pt.coord).addTo(map);
      } else {
        profileCursorMarker.setLngLat(pt.coord);
      }
    };

    const clearProfileHover = () => {
      if (chartHoverInfo) chartHoverInfo.innerText = '滑过图表联动3D地图';
      if (profileCursorMarker) profileCursorMarker.remove();
      profileCursorMarker = null;
    };

    canvas.addEventListener('mousemove', e => handleProfileHover(e.clientX));
    canvas.addEventListener('touchmove', e => {
      if (e.touches && e.touches[0]) {
        handleProfileHover(e.touches[0].clientX);
      }
    }, { passive: true });

    canvas.addEventListener('mouseleave', clearProfileHover);
    canvas.addEventListener('touchend', clearProfileHover);
  }
}

// 导出标准 GPX 1.1 轨迹文件 (带航点与海拔高程，完美兼容各大 GPS 与户外软件)
function exportRouteToGpx(routeData, map) {
  const name = routeData.name || 'Outmap_Route';
  const mode = routeData.mode || 'drive';
  const start = routeData.start;
  const end = routeData.end;
  const viaPoints = routeData.viaPoints || [];
  const pathCoords = routeData.pathCoords || currentPlannedRouteCoords || [];

  if (!pathCoords || pathCoords.length === 0) {
    alert('当前路线暂无有效轨迹坐标，无法导出！');
    return;
  }

  const escapeXml = (str) => String(str || '').replace(/[<>&'"]/g, c => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
    }
  });

  let gpx = '<?xml version="1.0" encoding="UTF-8"?>\n';
  gpx += '<gpx version="1.1" creator="Outmap 3D GIS" ';
  gpx += 'xmlns="http://www.topografix.com/GPX/1/1" ';
  gpx += 'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ';
  gpx += 'xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">\n';

  gpx += `  <metadata>\n`;
  gpx += `    <name>${escapeXml(name)}</name>\n`;
  gpx += `    <desc>由 Outmap 3D 导出路线 (出行方式: ${mode})</desc>\n`;
  gpx += `    <time>${new Date().toISOString()}</time>\n`;
  gpx += `  </metadata>\n`;

  // 航点: 起点
  if (start && start.coords) {
    const ele = getRealElevation(map, start.coords) || 0;
    gpx += `  <wpt lat="${start.coords[1].toFixed(6)}" lon="${start.coords[0].toFixed(6)}">\n`;
    gpx += `    <ele>${Math.round(ele)}</ele>\n`;
    gpx += `    <name>起点: ${escapeXml(start.name || '起点')}</name>\n`;
    gpx += `    <sym>Flag, Green</sym>\n`;
    gpx += `  </wpt>\n`;
  }

  // 航点: 途径点
  viaPoints.forEach((v, idx) => {
    if (v && v.coords) {
      const ele = getRealElevation(map, v.coords) || 0;
      gpx += `  <wpt lat="${v.coords[1].toFixed(6)}" lon="${v.coords[0].toFixed(6)}">\n`;
      gpx += `    <ele>${Math.round(ele)}</ele>\n`;
      gpx += `    <name>途径点 ${idx + 1}: ${escapeXml(v.name || '')}</name>\n`;
      gpx += `    <sym>Waypoint</sym>\n`;
      gpx += `  </wpt>\n`;
    }
  });

  // 航点: 终点
  if (end && end.coords) {
    const ele = getRealElevation(map, end.coords) || 0;
    gpx += `  <wpt lat="${end.coords[1].toFixed(6)}" lon="${end.coords[0].toFixed(6)}">\n`;
    gpx += `    <ele>${Math.round(ele)}</ele>\n`;
    gpx += `    <name>终点: ${escapeXml(end.name || '终点')}</name>\n`;
    gpx += `    <sym>Flag, Red</sym>\n`;
    gpx += `  </wpt>\n`;
  }

  // 完整轨迹线段
  gpx += `  <trk>\n`;
  gpx += `    <name>${escapeXml(name)}</name>\n`;
  gpx += `    <type>${mode === 'hike' ? 'Hiking' : (mode === 'cycle' ? 'Cycling' : 'Driving')}</type>\n`;
  gpx += `    <trkseg>\n`;

  pathCoords.forEach(pt => {
    const lng = pt[0];
    const lat = pt[1];
    let ele = pt[2];
    if (ele === undefined) {
      ele = getRealElevation(map, pt);
    }
    const eleVal = Math.round(ele || 0);
    gpx += `      <trkpt lat="${lat.toFixed(6)}" lon="${lng.toFixed(6)}"><ele>${eleVal}</ele></trkpt>\n`;
  });

  gpx += `    </trkseg>\n`;
  gpx += `  </trk>\n`;
  gpx += `</gpx>`;

  const cleanFilename = `${name.replace(/[\\/:*?"<>|]/g, '_')}.gpx`;
  const blob = new Blob([gpx], { type: 'application/gpx+xml;charset=utf-8' });
  const downloadUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = cleanFilename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);
  }, 100);
}

// 调出保存的路线并在 3D 地图上完美复原
function loadSavedRoute(routeId, map) {
  const route = savedRoutes.find(r => r.id === routeId);
  if (!route) return;

  const btnClear = document.getElementById('btn-clear-route');
  if (btnClear) btnClear.click();

  // 还原出行模式
  activeRouteMode = route.mode || 'drive';
  document.querySelectorAll('.route-mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === activeRouteMode);
  });

  // 还原起点
  if (route.start && route.start.coords) {
    setRouteStartPoint(map, route.start.coords, route.start.name || '起点');
  }

  // 还原途径点
  if (route.viaPoints && route.viaPoints.length > 0) {
    route.viaPoints.forEach((via, i) => {
      addViaPoint(map, via.coords, via.name || `途径点 ${i + 1}`);
    });
  }

  // 还原终点
  if (route.end && route.end.coords) {
    setRouteEndPoint(map, route.end.coords, route.end.name || '终点');
  }

  // 还原 3D 轨迹线与高程剖面
  if (route.pathCoords && route.pathCoords.length > 0) {
    currentPlannedRouteCoords = route.pathCoords;
    renderRouteGeometry(map, route.pathCoords);
    const m = route.metrics || {};
    updateProfileAndMetrics(map, route.pathCoords, m.distKm, null, true, true);
  }

  // 关闭其余右下角抽屉，展开路线规划面板
  closeConflictingBottomPanels('route-panel');
  const routePanel = document.getElementById('route-panel');
  if (routePanel) routePanel.style.display = 'flex';
}

// 绘制精美流畅的 Canvas 海拔剖面图
function drawElevationChart(canvas, data) {
  if (!canvas || !data || data.length === 0) return;
  // 响应式自适应容器宽度 (手机/桌面端皆完美铺满)
  const containerW = canvas.parentElement ? canvas.parentElement.clientWidth : 370;
  if (containerW > 50 && Math.abs(canvas.width - containerW) > 2) {
    canvas.width = containerW;
  }
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const paddingLeft = 32;
  const paddingRight = 12;
  const paddingTop = 12;
  const paddingBottom = 20;

  const chartW = w - paddingLeft - paddingRight;
  const chartH = h - paddingTop - paddingBottom;

  let minEle = Infinity;
  let maxEle = -Infinity;
  data.forEach(d => {
    if (d.ele < minEle) minEle = d.ele;
    if (d.ele > maxEle) maxEle = d.ele;
  });

  const totalDist = data[data.length - 1].distKm;
  const eleSpan = Math.max(100, maxEle - minEle);

  // 绘制网格线与 Y 轴刻度
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.fillStyle = '#94a3b8';
  ctx.font = '9px monospace';

  for (let i = 0; i <= 3; i++) {
    const y = paddingTop + (chartH / 3) * i;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(w - paddingRight, y);
    ctx.stroke();

    const val = Math.round(maxEle - (eleSpan / 3) * i);
    ctx.fillText(`${val}m`, 4, y + 3);
  }

  // 绘制 X 轴距离刻度
  ctx.fillText('0km', paddingLeft, h - 6);
  ctx.fillText(`${totalDist.toFixed(1)}km`, w - paddingRight - 32, h - 6);

  // 绘制渐变填充曲线
  ctx.beginPath();
  data.forEach((d, i) => {
    const x = paddingLeft + (d.distKm / totalDist) * chartW;
    const y = paddingTop + chartH - ((d.ele - minEle) / eleSpan) * chartH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  const lastX = paddingLeft + chartW;
  ctx.lineTo(lastX, paddingTop + chartH);
  ctx.lineTo(paddingLeft, paddingTop + chartH);
  ctx.closePath();

  const gradient = ctx.createLinearGradient(0, paddingTop, 0, paddingTop + chartH);
  gradient.addColorStop(0, 'rgba(124, 58, 237, 0.40)');
  gradient.addColorStop(1, 'rgba(139, 92, 246, 0.03)');
  ctx.fillStyle = gradient;
  ctx.fill();

  // 绘制曲线勾边 (高对比电光紫)
  ctx.beginPath();
  data.forEach((d, i) => {
    const x = paddingLeft + (d.distKm / totalDist) * chartW;
    const y = paddingTop + chartH - ((d.ele - minEle) / eleSpan) * chartH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = '#7c3aed';
  ctx.lineWidth = 2;
  ctx.stroke();
}

// 右键地图上下文菜单系统 (右键添加地点到收藏夹、设为起点、添加途径点、设为终点)
function setupMapContextMenu(map) {
  const ctxMenu = document.getElementById('map-context-menu');
  const ctxPlaceName = document.getElementById('ctx-place-name');
  const ctxPlaceMeta = document.getElementById('ctx-place-meta');
  const btnAddFav = document.getElementById('ctx-btn-add-fav');
  const btnRouteStart = document.getElementById('ctx-btn-route-start');
  const btnRouteVia = document.getElementById('ctx-btn-route-via');
  const btnRouteEnd = document.getElementById('ctx-btn-route-end');

  const wpModal = document.getElementById('waypoint-modal');
  const wpNameInput = document.getElementById('wp-name');
  const wpCoordsVal = document.getElementById('wp-coords-val');
  const wpEleVal = document.getElementById('wp-ele-val');

  let currentContextPoint = null;

  const hideContextMenu = () => {
    if (ctxMenu) ctxMenu.style.display = 'none';
  };

  // 监听地图右键事件与移动端长按触控事件 (展现高质感 Fluent 交互卡片)
  const showContextMenuAtPoint = (lngLat, point, customName = null) => {
    const { lng, lat } = lngLat;
    const ele = Math.round(getRealElevation(map, lngLat) || 0);

    // 智能提取所点位置的行政区划或使用传入的精准自定义地名
    const rawLoc = customName || resolveLocationInfo(map, lngLat, point, true);
    const cleanLocation = (rawLoc || '地点')
      .replace(/^中国\s*[·,\-–]\s*/, '')
      .replace(/China\s*[·,\-–]\s*/i, '');

    currentContextPoint = {
      lng,
      lat,
      ele,
      placeName: cleanLocation || '地点'
    };

    if (ctxPlaceName) ctxPlaceName.innerText = currentContextPoint.placeName;
    if (ctxPlaceMeta) ctxPlaceMeta.innerText = `${lng.toFixed(4)}°E, ${lat.toFixed(4)}°N · ${ele}m`;

    if (ctxMenu) {
      const wrap = document.getElementById('map-wrap');
      const maxW = wrap ? wrap.clientWidth - 180 : window.innerWidth - 180;
      const maxH = wrap ? wrap.clientHeight - 180 : window.innerHeight - 180;
      const x = Math.max(10, Math.min(point.x, maxW));
      const y = Math.max(10, Math.min(point.y, maxH));

      ctxMenu.style.left = `${x}px`;
      ctxMenu.style.top = `${y}px`;
      ctxMenu.style.display = 'block';
    }
  };

  // 挂载到 window 供全局及标记点右键调用
  window.showContextMenuForLocation = (lngLat, point, customName = null) => {
    showContextMenuAtPoint(lngLat, point, customName);
  };

  map.on('contextmenu', e => {
    showContextMenuAtPoint(e.lngLat, e.point);
  });

  // 移动端触屏单指长按 520ms 唤起地点交互菜单 (手机无鼠标右键时流畅选点)
  let longPressTimer = null;
  let touchStartPoint = null;

  map.on('touchstart', e => {
    if (e.points && e.points.length > 1) {
      if (longPressTimer) clearTimeout(longPressTimer);
      longPressTimer = null;
      return;
    }
    touchStartPoint = e.point;
    longPressTimer = setTimeout(() => {
      showContextMenuAtPoint(e.lngLat, e.point);
      longPressTimer = null;
    }, 520);
  });

  map.on('touchmove', e => {
    if (longPressTimer && touchStartPoint) {
      const dist = Math.hypot(e.point.x - touchStartPoint.x, e.point.y - touchStartPoint.y);
      if (dist > 10) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    }
  });

  map.on('touchend', () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  });

  // 1. 右键菜单：添加地点到收藏夹
  btnAddFav?.addEventListener('click', () => {
    hideContextMenu();
    if (!currentContextPoint) return;

    tempPickedPoint = {
      lng: currentContextPoint.lng,
      lat: currentContextPoint.lat,
      ele: currentContextPoint.ele
    };

    if (wpCoordsVal) wpCoordsVal.innerText = `${currentContextPoint.lng.toFixed(4)}°E, ${currentContextPoint.lat.toFixed(4)}°N`;
    if (wpEleVal) wpEleVal.innerText = `${currentContextPoint.ele} m`;
    if (wpNameInput) {
      wpNameInput.value = currentContextPoint.placeName;
      wpNameInput.focus();
    }
    closeConflictingBottomPanels('waypoint-modal');
    if (wpModal) wpModal.style.display = 'flex';
  });

  // 2. 右键菜单：设为路线起点
  btnRouteStart?.addEventListener('click', () => {
    hideContextMenu();
    if (!currentContextPoint) return;
    setRouteStartPoint(map, [currentContextPoint.lng, currentContextPoint.lat], currentContextPoint.placeName);
  });

  // 3. 右键菜单：添加为路线途径点
  btnRouteVia?.addEventListener('click', () => {
    hideContextMenu();
    if (!currentContextPoint) return;
    addViaPoint(map, [currentContextPoint.lng, currentContextPoint.lat], currentContextPoint.placeName);
  });

  // 4. 右键菜单：设为路线终点
  btnRouteEnd?.addEventListener('click', () => {
    hideContextMenu();
    if (!currentContextPoint) return;
    setRouteEndPoint(map, [currentContextPoint.lng, currentContextPoint.lat], currentContextPoint.placeName);
  });

  // 隐藏右键菜单触发机制
  map.on('click', hideContextMenu);
  map.on('movestart', hideContextMenu);
  document.addEventListener('click', e => {
    if (ctxMenu && !ctxMenu.contains(e.target)) {
      hideContextMenu();
    }
  });
}

// 全局统一键盘快捷键与 ESC 键层级防穿透调度系统 (确保严格按顶层可见窗口依次退出)
function setupGlobalKeyboardDispatcher() {
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      // 1. 最高优先级：离线下载对话框省份下拉浮层与对话框
      const provDropdownPanel = document.getElementById('pyramid-prov-dropdown-panel');
      if (provDropdownPanel && provDropdownPanel.style.display !== 'none') {
        provDropdownPanel.style.display = 'none';
        const trigger = document.getElementById('pyramid-prov-dropdown-trigger');
        if (trigger) trigger.classList.remove('active');
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }

      const pyramidModal = document.getElementById('pyramid-modal');
      if (pyramidModal && pyramidModal.style.display !== 'none') {
        if (window.closePyramidModal) {
          window.closePyramidModal();
        } else {
          pyramidModal.style.display = 'none';
          const btnDl = document.getElementById('btn-open-pyramid-dl');
          if (btnDl) btnDl.classList.remove('expanded');
        }
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }

      // 2. 版本更新提示弹窗
      const updateModal = document.getElementById('update-modal');
      if (updateModal && updateModal.style.display !== 'none') {
        updateModal.style.display = 'none';
        const btnCancel = document.getElementById('btn-cancel-update');
        const btnClose = document.getElementById('btn-close-update-modal');
        const progressBox = document.getElementById('update-progress-box');
        const btnStart = document.getElementById('btn-start-update');
        if (btnCancel) btnCancel.style.display = '';
        if (btnClose) btnClose.style.display = '';
        if (progressBox) progressBox.style.display = 'none';
        if (btnStart) {
          btnStart.disabled = false;
          btnStart.innerText = '⚡ 立即更新并重启';
        }
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }

      // 4. 地标收藏输入弹窗
      const wpModal = document.getElementById('waypoint-modal');
      if (wpModal && wpModal.style.display !== 'none') {
        wpModal.style.display = 'none';
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }

      // 5. 路线规划面板
      const routePanel = document.getElementById('route-panel');
      if (routePanel && routePanel.style.display !== 'none') {
        routePanel.style.display = 'none';
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }

      // 6. 收藏夹抽屉面板
      const favPanel = document.getElementById('favorite-panel');
      if (favPanel && favPanel.style.display !== 'none') {
        favPanel.style.display = 'none';
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }

      // 7. 全国总览省份拼音展开面板
      const provPopover = document.getElementById('prov-popover-menu');
      if (provPopover && provPopover.style.display !== 'none') {
        provPopover.style.display = 'none';
        const provTriggerBtn = document.getElementById('btn-prov-dropdown-trigger');
        if (provTriggerBtn) provTriggerBtn.classList.remove('active');
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }

      // 3. 云端多设备同步弹窗
      const syncModal = document.getElementById('sync-modal');
      if (syncModal && syncModal.style.display !== 'none') {
        syncModal.style.display = 'none';
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }

      // 8. 搜索浮动面板
      const searchPopover = document.getElementById('search-popover') || document.getElementById('spotlight-modal');
      if (searchPopover && searchPopover.style.display !== 'none') {
        searchPopover.style.display = 'none';
        const sInput = document.getElementById('global-search-input');
        if (sInput) sInput.blur();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }

      // 8.5. 顶栏版本翻转卡片
      const brandFlipCard = document.getElementById('brand-flip-card');
      if (brandFlipCard && brandFlipCard.classList.contains('flipped')) {
        brandFlipCard.classList.remove('flipped');
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }

      // 9. 地图右键菜单
      const ctxMenu = document.getElementById('map-context-menu');
      if (ctxMenu && ctxMenu.style.display !== 'none') {
        ctxMenu.style.display = 'none';
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }
    }
  }, true); // 使用捕获阶段 (capture: true) 确保最先响应
}

// 应用程序启动
initApplication();
