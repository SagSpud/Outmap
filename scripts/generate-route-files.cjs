const fs = require('fs');
const path = require('path');

const points = [
  {
    index: 1,
    name: '成都天府国际机场',
    alias: '成都天府国际机场T1/T2',
    date: '2026-06-05',
    lng: 104.4447,
    lat: 30.3235,
    ele: 442,
    province: '四川省',
    city: '成都市',
    district: '简阳市',
    address: '四川省成都市简阳市芦葭镇空港大道',
    desc: '川滇自驾大环线起点/集合抵达点'
  },
  {
    index: 2,
    name: '泸定桥',
    alias: '大渡河泸定桥风景名胜区',
    date: '2026-06-05',
    lng: 102.2348,
    lat: 29.9142,
    ele: 1332,
    province: '四川省',
    city: '甘孜藏族自治州',
    district: '泸定县',
    address: '四川省甘孜州泸定县泸桥镇大渡河上',
    desc: '大渡河著名历史名胜铁索桥'
  },
  {
    index: 3,
    name: '泸定县',
    alias: '泸定县城（泸桥镇）',
    date: '2026-06-05',
    lng: 102.2355,
    lat: 29.9130,
    ele: 1345,
    province: '四川省',
    city: '甘孜藏族自治州',
    district: '泸定县',
    address: '四川省甘孜州泸定县城中心',
    desc: '06.05 住宿地，大渡河谷'
  },
  {
    index: 4,
    name: '红海子',
    alias: '康定红海子（加达通村旁）',
    date: '2026-06-06',
    lng: 101.8682,
    lat: 30.1558,
    ele: 4200,
    province: '四川省',
    city: '甘孜藏族自治州',
    district: '康定市',
    address: '四川省甘孜州康定市S434省道旁',
    desc: 'S434绝美高原海子，眺望笔架山雪峰'
  },
  {
    index: 5,
    name: '斯丁措',
    alias: '康定机场旁斯丁措湖',
    date: '2026-06-06',
    lng: 101.7485,
    lat: 30.1415,
    ele: 4260,
    province: '四川省',
    city: '甘孜藏族自治州',
    district: '康定市',
    address: '四川省甘孜州康定市折多山顶康定机场附近',
    desc: '高原秘境湖泊，直面贡嘎雪山与雅拉雪山'
  },
  {
    index: 6,
    name: '折多山观雪台',
    alias: 'G318折多山垭口观雪台',
    date: '2026-06-06',
    lng: 101.8286,
    lat: 30.0382,
    ele: 4298,
    province: '四川省',
    city: '甘孜藏族自治州',
    district: '康定市',
    address: '四川省甘孜州康定市G318国道折多山垭口',
    desc: '康巴第一关，海拔4298米观雪台'
  },
  {
    index: 7,
    name: '新都桥',
    alias: '新都桥镇（摄影家走廊）',
    date: '2026-06-06',
    lng: 101.5230,
    lat: 30.0520,
    ele: 3460,
    province: '四川省',
    city: '甘孜藏族自治州',
    district: '康定市',
    address: '四川省甘孜州康定市新都桥镇',
    desc: '光影交错的摄影家天堂，06.06住宿地'
  },
  {
    index: 8,
    name: '巴塘县',
    alias: '巴塘县城（夏邛镇）',
    date: '2026-06-07',
    lng: 99.1085,
    lat: 30.0040,
    ele: 2580,
    province: '四川省',
    city: '甘孜藏族自治州',
    district: '巴塘县',
    address: '四川省甘孜州巴塘县夏邛镇',
    desc: '川藏南线出川前最后一站高原绿洲，06.07住宿地'
  },
  {
    index: 9,
    name: '金沙江大桥(G318川藏界)',
    alias: 'G318竹巴龙金沙江大桥',
    date: '2026-06-08',
    lng: 98.9818,
    lat: 29.8458,
    ele: 2480,
    province: '四川/西藏交界',
    city: '甘孜州巴塘县 / 昌都市芒康县',
    district: '竹巴龙乡',
    address: 'G318国道川藏界金沙江大桥（四川巴塘竹巴龙-西藏芒康朱巴龙）',
    desc: '川藏分界大桥，跨越金沙江正式入藏'
  },
  {
    index: 10,
    name: '芒康盐井旅游景区',
    alias: '千年古盐田风景区',
    date: '2026-06-08',
    lng: 98.6015,
    lat: 29.0435,
    ele: 2350,
    province: '西藏自治区',
    city: '昌都市',
    district: '芒康县',
    address: '西藏昌都市芒康县盐井纳西民族乡',
    desc: '世界上唯一完整保存的人工原始晒盐古盐田'
  },
  {
    index: 11,
    name: '加达村(西藏芒康县盐井乡)',
    alias: '盐井乡加达村红盐田',
    date: '2026-06-08',
    lng: 98.5910,
    lat: 29.0412,
    ele: 2320,
    province: '西藏自治区',
    city: '昌都市',
    district: '芒康县',
    address: '西藏自治区昌都市芒康县盐井纳西民族乡加达村',
    desc: '澜沧江峡谷西岸纯红盐古盐田村落，自驾打卡核心'
  },
  {
    index: 12,
    name: '飞来寺风景区观景台',
    alias: '飞来寺观景台（正对梅里雪山）',
    date: '2026-06-08',
    lng: 98.8788,
    lat: 28.4410,
    ele: 3420,
    province: '云南省',
    city: '迪庆藏族自治州',
    district: '德钦县',
    address: '云南省迪庆州德钦县升平镇G214旁',
    desc: '直面梅里雪山十三峰与卡瓦格博峰日照金山经典圣地'
  },
  {
    index: 13,
    name: '飞来寺',
    alias: '德钦飞来寺古刹',
    date: '2026-06-08',
    lng: 98.8795,
    lat: 28.4395,
    ele: 3400,
    province: '云南省',
    city: '迪庆藏族自治州',
    district: '德钦县',
    address: '云南省迪庆州德钦县升平镇飞来寺村',
    desc: '建于明代的藏传佛教古刹，06.08住宿打卡地'
  },
  {
    index: 14,
    name: '白马雪山垭口',
    alias: 'G214白马雪山老垭口观景台',
    date: '2026-06-09',
    lng: 99.0335,
    lat: 28.3245,
    ele: 4292,
    province: '云南省',
    city: '迪庆藏族自治州',
    district: '德钦县',
    address: '云南省迪庆州德钦县G214老线白马雪山垭口',
    desc: '海拔4292米，滇藏公路最高点壮阔雪山垭口'
  },
  {
    index: 15,
    name: '奔子栏',
    alias: '奔子栏镇（茶马古道金沙江重镇）',
    date: '2026-06-09',
    lng: 99.3092,
    lat: 28.2435,
    ele: 2050,
    province: '云南省',
    city: '迪庆藏族自治州',
    district: '德钦县',
    address: '云南省迪庆州德钦县奔子栏镇',
    desc: '金沙江河谷要塞，茶马古道咽喉重镇'
  },
  {
    index: 16,
    name: '纳帕海',
    alias: '纳帕海国家湿地公园 / 依拉草原',
    date: '2026-06-09',
    lng: 99.6450,
    lat: 27.8760,
    ele: 3270,
    province: '云南省',
    city: '迪庆藏族自治州',
    district: '香格里拉市',
    address: '云南省迪庆州香格里拉市建塘镇纳帕海',
    desc: '香格里拉高原湿地水上公路与草原牧场'
  },
  {
    index: 17,
    name: '香格里拉独克宗古城',
    alias: '独克宗月光城（龟山大转经筒）',
    date: '2026-06-09',
    lng: 99.7042,
    lat: 27.8138,
    ele: 3280,
    province: '云南省',
    city: '迪庆藏族自治州',
    district: '香格里拉市',
    address: '云南省迪庆州香格里拉市金龙街',
    desc: '茶马古道重镇，06.09住宿及夜景核心'
  },
  {
    index: 18,
    name: '松赞林景区',
    alias: '噶丹·松赞林寺',
    date: '2026-06-10',
    lng: 99.7045,
    lat: 27.8635,
    ele: 3380,
    province: '云南省',
    city: '迪庆藏族自治州',
    district: '香格里拉市',
    address: '云南省迪庆州香格里拉市建塘镇尼旺路',
    desc: '云南最大藏传佛教寺院，享有“归化寺/小布达拉宫”美誉'
  },
  {
    index: 19,
    name: '虎跳峡镇',
    alias: '香格里拉市虎跳峡镇',
    date: '2026-06-10',
    lng: 100.0768,
    lat: 27.1852,
    ele: 1850,
    province: '云南省',
    city: '迪庆藏族自治州',
    district: '香格里拉市',
    address: '云南省迪庆州香格里拉市虎跳峡镇人民政府驻地',
    desc: '进入虎跳峡峡谷前哨镇，06.10住宿地'
  },
  {
    index: 20,
    name: '香格里拉虎跳峡景区',
    alias: '虎跳峡风景名胜区（上虎跳/中虎跳）',
    date: '2026-06-11',
    lng: 100.1250,
    lat: 27.1820,
    ele: 1800,
    province: '云南省',
    city: '迪庆藏族自治州',
    district: '香格里拉市',
    address: '云南省迪庆州香格里拉市虎跳峡镇东侧金沙江大峡谷',
    desc: '世界上最深、最壮观的大峡谷之一，惊涛拍岸'
  },
  {
    index: 21,
    name: '哈巴雪山观景台',
    alias: '虎香公路哈巴雪山观景台',
    date: '2026-06-11',
    lng: 100.1730,
    lat: 27.2890,
    ele: 2750,
    province: '云南省',
    city: '迪庆藏族自治州',
    district: '香格里拉市',
    address: '云南省迪庆州香格里拉市东环线/虎香公路',
    desc: '遥望哈巴雪山峰群与高山草甸的最佳全景观赏点'
  },
  {
    index: 22,
    name: '白沙古镇',
    alias: '白沙古镇风景区',
    date: '2026-06-11',
    lng: 100.2185,
    lat: 26.9565,
    ele: 2450,
    province: '云南省',
    city: '丽江市',
    district: '玉龙纳西族自治县',
    address: '云南省丽江市玉龙县白沙镇',
    desc: '纳西族最早的聚居地，最原生态慢节奏古镇，06.11住宿地'
  },
  {
    index: 23,
    name: '玉湖村',
    alias: '玉龙雪山第一村 / 洛克故居',
    date: '2026-06-12',
    lng: 100.2215,
    lat: 27.0285,
    ele: 2700,
    province: '云南省',
    city: '丽江市',
    district: '玉龙纳西族自治县',
    address: '云南省丽江市玉龙县白沙镇玉湖村',
    desc: '玉龙雪山南麓石头村落，约瑟夫·洛克故居所在地'
  },
  {
    index: 24,
    name: '沙溪古镇',
    alias: '沙溪古镇（寺登街、玉津桥）',
    date: '2026-06-12',
    lng: 99.8512,
    lat: 26.3195,
    ele: 2100,
    province: '云南省',
    city: '大理白族自治州',
    district: '剑川县',
    address: '云南省大理州剑川县沙溪镇寺登街',
    desc: '茶马古道上唯一幸存的古集市，黑惠江与玉津桥绝美风光'
  },
  {
    index: 25,
    name: '洱海生态廊道',
    alias: '大理洱海生态廊道（才村/阳南溪段）',
    date: '2026-06-12',
    lng: 100.1875,
    lat: 25.7265,
    ele: 1972,
    province: '云南省',
    city: '大理白族自治州',
    district: '大理市',
    address: '云南省大理州大理市洱海西岸',
    desc: '苍山洱海骑行与漫步核心走廊'
  },
  {
    index: 26,
    name: '大理古城',
    alias: '大理古城南门 / 复兴路',
    date: '2026-06-12',
    lng: 100.1650,
    lat: 25.6965,
    ele: 1980,
    province: '云南省',
    city: '大理白族自治州',
    district: '大理市',
    address: '云南省大理州大理市大理镇一塔路',
    desc: '风花雪月大理核心古城，06.12住宿地'
  },
  {
    index: 27,
    name: '大理北门菜市场',
    alias: '大理古城北门农贸市场',
    date: '2026-06-13',
    lng: 100.1658,
    lat: 25.7062,
    ele: 1985,
    province: '云南省',
    city: '大理白族自治州',
    district: '大理市',
    address: '云南省大理州大理市大理古城北门街',
    desc: '烟火气最浓的大理本地农贸早市与特色小吃聚集地'
  },
  {
    index: 28,
    name: '云南省博物馆',
    alias: '云南省博物馆新馆',
    date: '2026-06-13',
    lng: 102.7538,
    lat: 24.9525,
    ele: 1890,
    province: '云南省',
    city: '昆明市',
    district: '官渡区',
    address: '云南省昆明市官渡区广福路6393号',
    desc: '云南历史文化殿堂，古滇国青铜重器与南诏大理国瑰宝'
  },
  {
    index: 29,
    name: '昆明万象城',
    alias: '华润昆明万象城',
    date: '2026-06-13',
    lng: 102.7305,
    lat: 25.0345,
    ele: 1890,
    province: '云南省',
    city: '昆明市',
    district: '官渡区',
    address: '云南省昆明市官渡区环城南路与东郊路交叉口',
    desc: '返程前市区补给购物与餐饮中心'
  },
  {
    index: 30,
    name: '昆明长水国际机场T1航站楼',
    alias: '昆明长水国际机场（出发层）',
    date: '2026-06-13',
    lng: 102.9350,
    lat: 25.1055,
    ele: 2102,
    province: '云南省',
    city: '昆明市',
    district: '官渡区',
    address: '云南省昆明市官渡区长水国际机场T1航站楼',
    desc: '川滇大环线自驾圆满收官/返程航班出发点'
  }
];

const outDir = path.resolve(__dirname, '..', 'exports');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// 1. 生成 CSV (带 UTF-8 BOM，Excel/奥维/Google My Maps 打开绝无乱码)
function generateCSV() {
  const headers = ['序号', '名称', '推荐别名', '规划日期', '省份', '城市', '区县', '经度', '纬度', '海拔(米)', '详细地址', '地点介绍'];
  const rows = points.map(p => [
    p.index,
    `"${p.name.replace(/"/g, '""')}"`,
    `"${p.alias.replace(/"/g, '""')}"`,
    `"${p.date}"`,
    `"${p.province}"`,
    `"${p.city}"`,
    `"${p.district}"`,
    p.lng.toFixed(6),
    p.lat.toFixed(6),
    p.ele,
    `"${p.address.replace(/"/g, '""')}"`,
    `"${p.desc.replace(/"/g, '""')}"`
  ].join(','));

  // UTF-8 BOM: \uFEFF
  const content = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  const filePath = path.join(outDir, '川滇自驾大环线核心途经点.csv');
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ CSV 生成成功:', filePath);
  return filePath;
}

// 2. 生成标准 GPX 1.1 文件 (支持 Garmin、两步路、奥维、Outmap 3D 直接拖拽导入)
function generateGPX() {
  const wpts = points.map(p => `  <wpt lat="${p.lat.toFixed(6)}" lon="${p.lng.toFixed(6)}">
    <ele>${p.ele}</ele>
    <time>${p.date}T08:00:00Z</time>
    <name>${escapeXml(p.name)}</name>
    <desc>${escapeXml(`[${p.date}] ${p.province}${p.city}${p.district} - ${p.desc}`)}</desc>
    <sym>Flag, Blue</sym>
    <type>${p.index === 1 ? 'Start' : (p.index === points.length ? 'End' : 'Via')}</type>
  </wpt>`).join('\n');

  const rtepts = points.map(p => `    <rtept lat="${p.lat.toFixed(6)}" lon="${p.lng.toFixed(6)}">
      <ele>${p.ele}</ele>
      <name>${escapeXml(p.name)}</name>
    </rtept>`).join('\n');

  const trkpts = points.map(p => `      <trkpt lat="${p.lat.toFixed(6)}" lon="${p.lng.toFixed(6)}">
        <ele>${p.ele}</ele>
        <time>${p.date}T08:00:00Z</time>
        <name>${escapeXml(p.name)}</name>
      </trkpt>`).join('\n');

  const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Outmap 3D GIS (https://map.053999.xyz)"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>川滇自驾大环线核心途经点 (成都-川西-滇西北-昆明)</name>
    <desc>全程精选30个核心控制途经点，覆盖06.05-06.13完整自驾行程。</desc>
    <time>2026-06-05T00:00:00Z</time>
  </metadata>
${wpts}
  <rte>
    <name>川滇大环线自驾路线</name>
    <desc>成都 → 泸定 → 新都桥 → 巴塘 → 芒康盐井 → 飞来寺 → 奔子栏 → 香格里拉 → 虎跳峡 → 丽江 → 沙溪 → 大理 → 昆明</desc>
${rtepts}
  </rte>
  <trk>
    <name>川滇自驾大环线轨迹连线</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;

  const filePath = path.join(outDir, '川滇自驾大环线核心途经点.gpx');
  fs.writeFileSync(filePath, gpx, 'utf8');
  console.log('✅ GPX 生成成功:', filePath);
  return filePath;
}

// 3. 生成 KML 2.2 文件 (Google Earth / Google My Maps / 奥维 / Organic Maps)
function generateKML() {
  const placemarks = points.map(p => `    <Placemark>
      <name>${escapeXml(p.name)}</name>
      <description><![CDATA[
        <div style="font-family: sans-serif; font-size: 13px;">
          <p><strong>序号：</strong>#${p.index} (${p.date})</p>
          <p><strong>行政区：</strong>${p.province} ${p.city} ${p.district}</p>
          <p><strong>海拔：</strong>${p.ele} 米</p>
          <p><strong>地点介绍：</strong>${p.desc}</p>
          <p><strong>详细地址：</strong>${p.address}</p>
          <p><strong>坐标(WGS84)：</strong>${p.lng.toFixed(6)}°E, ${p.lat.toFixed(6)}°N</p>
        </div>
      ]]></description>
      <Point>
        <coordinates>${p.lng.toFixed(6)},${p.lat.toFixed(6)},${p.ele}</coordinates>
      </Point>
    </Placemark>`).join('\n');

  const lineCoords = points.map(p => `${p.lng.toFixed(6)},${p.lat.toFixed(6)},${p.ele}`).join(' ');

  const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>川滇自驾大环线核心途经点 (6月5日-13日)</name>
    <description>成都-泸定-新都桥-巴塘-芒康盐井-飞来寺-香格里拉-虎跳峡-丽江-沙溪-大理-昆明</description>
    <Style id="routeLine">
      <LineStyle>
        <color>ff0088ff</color>
        <width>4</width>
      </LineStyle>
    </Style>
    <Folder>
      <name>30个核心控制点位</name>
${placemarks}
    </Folder>
    <Placemark>
      <name>川滇大环线总览轨迹线</name>
      <styleUrl>#routeLine</styleUrl>
      <LineString>
        <tessellate>1</tessellate>
        <altitudeMode>clampToGround</altitudeMode>
        <coordinates>${lineCoords}</coordinates>
      </LineString>
    </Placemark>
  </Document>
</kml>`;

  const filePath = path.join(outDir, '川滇自驾大环线核心途经点.kml');
  fs.writeFileSync(filePath, kml, 'utf8');
  console.log('✅ KML 生成成功:', filePath);
  return filePath;
}

// 4. 生成标准 GeoJSON (Outmap 3D 与各大 GIS 工具直接拖入)
function generateGeoJSON() {
  const features = points.map(p => ({
    type: 'Feature',
    id: 'pt_' + p.index,
    geometry: {
      type: 'Point',
      coordinates: [p.lng, p.lat, p.ele]
    },
    properties: {
      order: p.index,
      name: p.name,
      alias: p.alias,
      date: p.date,
      elevation: p.ele,
      province: p.province,
      city: p.city,
      district: p.district,
      address: p.address,
      description: `[${p.date}] ${p.name} - ${p.desc}`,
      type: p.index === 1 ? 'start' : (p.index === points.length ? 'end' : 'via')
    }
  }));

  // 路线几何
  features.push({
    type: 'Feature',
    id: 'route_overview_line',
    geometry: {
      type: 'LineString',
      coordinates: points.map(p => [p.lng, p.lat, p.ele])
    },
    properties: {
      name: '川滇自驾大环线 (30个核心控制点)',
      distanceKm: 2160,
      startDate: '2026-06-05',
      endDate: '2026-06-13'
    }
  });

  const geojson = {
    type: 'FeatureCollection',
    name: '川滇自驾大环线核心途经点',
    features
  };

  const filePath = path.join(outDir, '川滇自驾大环线核心途经点.geojson');
  fs.writeFileSync(filePath, JSON.stringify(geojson, null, 2), 'utf8');
  console.log('✅ GeoJSON 生成成功:', filePath);
  return filePath;
}

// 5. 生成 Outmap 原生收藏路线 JSON 格式 (在 Outmap 中打开即为规划就绪路线)
function generateOutmapRouteJson() {
  const startPt = points[0];
  const endPt = points[points.length - 1];
  const viaList = points.slice(1, -1).map((p, idx) => ({
    id: 'via_custom_' + (idx + 1),
    name: p.name,
    coords: [p.lng, p.lat],
    ele: p.ele,
    desc: p.desc
  }));

  const outmapRoute = {
    id: 'route_chuandian_20260605',
    name: '川滇自驾大环线 (6.5-6.13 精选30个核心点)',
    mode: 'drive',
    createdAt: new Date().toISOString(),
    start: {
      name: startPt.name,
      coords: [startPt.lng, startPt.lat],
      ele: startPt.ele
    },
    end: {
      name: endPt.name,
      coords: [endPt.lng, endPt.lat],
      ele: endPt.ele
    },
    viaPoints: viaList,
    pathCoords: points.map(p => [p.lng, p.lat]),
    metrics: {
      distKm: 2160,
      timeStr: '约 9 天自驾行程',
      totalAscent: 18500
    },
    notes: '06.05 成都-泸定 | 06.06 泸定-新都桥 | 06.07 新都桥-巴塘 | 06.08 巴塘-飞来寺 | 06.09 飞来寺-香格里拉 | 06.10 香格里拉-虎跳峡 | 06.11 虎跳峡-白沙古镇 | 06.12 白沙-沙溪-大理 | 06.13 大理-昆明'
  };

  const filePath = path.join(outDir, '川滇自驾大环线_Outmap路线存档.json');
  fs.writeFileSync(filePath, JSON.stringify(outmapRoute, null, 2), 'utf8');
  console.log('✅ Outmap 路线存档生成成功:', filePath);
  return filePath;
}

function escapeXml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

generateCSV();
generateGPX();
generateKML();
generateGeoJSON();
generateOutmapRouteJson();

console.log('\n🎉 全部 5 大格式自驾途经点文件生成完成！');
