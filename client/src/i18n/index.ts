import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import commonCn from './cn/common';
import commonEn from './en/common';
import buttonEn from './en/button';
import buttonCn from './cn/button';
import warningCn from './cn/warning';
import warningEn from './en/warning';
import navCn from './cn/nav';
import navEn from './en/nav';
import homeCn from './cn/home';
import homeEn from './en/home';
import collectionCn from './cn/collection';
import collectionEn from './en/collection';
import dialogCn from './cn/dialog';
import dialogEn from './en/dialog';
import partitionCn from './cn/partition';
import partitionEn from './en/partition';
import successEn from './en/success';
import successCn from './cn/success';
import indexEn from './en/index';
import indexCn from './cn/index';
import insertEn from './en/insert';
import insertCn from './cn/insert';
import searchEn from './en/search';
import searchCn from './cn/search';
import systemViewTransEn from './en/systemView';
import systemViewTransCn from './cn/systemView';
import userTransEn from './en/user';
import userTransCn from './cn/user';
import databaseTransEn from './en/database';
import databaseTransCn from './cn/database';
import propertiesEn from './en/properties';
import propertiesCn from './cn/properties';
import actionEn from './en/action';
import actionCn from './cn/action';

export const resources = {
  'zh-CN': {
    translation: commonCn,
    btn: buttonCn,
    warning: warningCn,
    nav: navCn,
    home: homeCn,
    collection: collectionCn,
    dialog: dialogCn,
    partition: partitionCn,
    success: successCn,
    index: indexCn,
    insert: insertCn,
    search: searchCn,
    systemView: systemViewTransCn,
    user: userTransCn,
    database: databaseTransCn,
    properties: propertiesCn,
    action: actionCn,
  },
  en: {
    translation: commonEn,
    btn: buttonEn,
    warning: warningEn,
    nav: navEn,
    home: homeEn,
    collection: collectionEn,
    dialog: dialogEn,
    partition: partitionEn,
    success: successEn,
    index: indexEn,
    insert: insertEn,
    search: searchEn,
    systemView: systemViewTransEn,
    user: userTransEn,
    database: databaseTransEn,
    properties: propertiesEn,
    action: actionEn,
  },
};

const PHIGENT_LANG_KEY = 'phigent.ui.lang';
const ATTU_LANG_KEY = 'attu.ui.lang';

try {
  const legacyLang = localStorage.getItem(ATTU_LANG_KEY);
  if (legacyLang && !localStorage.getItem(PHIGENT_LANG_KEY)) {
    localStorage.setItem(PHIGENT_LANG_KEY, legacyLang);
  }
} catch (e) {
  // localStorage 不可用时使用语言探测器的其它来源。
}

// 翻译资源
// （建议移到 JSON 文件中再导入）
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    resources,
    keySeparator: '.',
    returnObjects: true,
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag', 'path', 'subdomain'],
      lookupLocalStorage: PHIGENT_LANG_KEY,
      lookupFromPathIndex: 0,
      lookupFromSubdomainIndex: 0,
      caches: ['localStorage', 'cookie'],
      excludeCacheFor: ['cimode'],
      cookieMinutes: 10,
      cookieDomain: '',
      htmlTag: document.documentElement,
    },
    supportedLngs: ['en', 'zh-CN'], // 在此处添加支持的语言
  });

export default i18n;
