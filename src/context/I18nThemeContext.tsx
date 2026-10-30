'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Theme as AstryxTheme } from '@astryxdesign/core/theme';
import { themes, defaultThemeSlug } from '../astryx-themes';

export type Language = 'vi' | 'en';
export type Theme = 'dark' | 'light';

export const translations = {
  vi: {
    // Header & Brand
    app_name: 'TrendPulse',
    app_badge: 'PWA • AI',
    connect_fb: 'Kết nối FB',
    connected: 'Đã kết nối',
    connecting: 'Đang kết nối...',
    refresh_data: 'Làm mới dữ liệu',
    refresh_now: 'Làm mới ngay',
    auto_refresh: 'Tự động làm mới',
    refresh_off: 'Tắt',
    refresh_every: 'Mỗi',
    refresh_15s: 'Mỗi 15 giây',
    refresh_30s: 'Mỗi 30 giây (Mặc định)',
    refresh_60s: 'Mỗi 1 phút',
    refresh_120s: 'Mỗi 2 phút',
    dry_run: 'Chạy thử',
    run_auto: 'Chạy tự động',
    run: 'Chạy',
    running: 'Đang chạy...',
    logout: 'Đăng xuất',
    logout_confirm: 'Bạn có chắc chắn muốn đăng xuất khỏi hệ thống?',
    logging_out: 'Đang đăng xuất...',
    theme_dark: 'Giao diện Tối',
    theme_light: 'Giao diện Sáng',
    lang_switch: 'Ngôn ngữ',

    // Navigation Tabs
    tab_overview: 'Tổng quan',
    tab_trends: 'Xu hướng',
    tab_posts: 'Bài viết',
    tab_logs: 'Nhật ký',
    tab_settings: 'Cài đặt',

    // Stats Cards
    stat_trends: 'Xu hướng',
    stat_drafts: 'Bản thảo',
    stat_published: 'Đã xuất bản',
    stat_logs: 'Nhật ký',

    // Overview Tab
    recent_published_title: 'Bài viết vừa xuất bản',
    view_all: 'Xem tất cả',
    no_published_posts: 'Chưa có bài viết nào được xuất bản. Bấm "Chạy tự động" để trải nghiệm.',
    auto_comment_prefix: '💬 Auto-comment:',

    // Trends Tab
    search_trends_placeholder: 'Tìm kiếm xu hướng...',
    region_all: '🌐 Tất cả',
    crawl_btn: 'Cào Trends',
    crawling: 'Đang cào...',
    no_trends_title: 'Chưa có dữ liệu xu hướng',
    no_trends_desc: 'Bấm nút "Cào Trends" để lấy xu hướng Kinh doanh & Tài chính mới nhất.',
    crawl_now: 'Cào ngay',
    traffic_label: 'Nhiều tìm kiếm',
    status_published: 'Đã đăng',
    status_drafted: 'Đã có bài',
    status_discovered: 'Mới phát hiện',
    source_links_count: 'bài báo nguồn',
    find_sources_btn: 'Tìm báo nguồn',
    searching_sources: 'Đang tìm...',
    generate_post_btn: 'Tạo bài viết AI',
    generating_post: 'Đang viết...',

    // Posts Tab
    filter_all: 'Tất cả',
    filter_draft: 'Bản thảo',
    filter_published: 'Đã đăng',
    filter_failed: 'Lỗi',
    filter_publishing: 'Đang đăng...',
    no_posts_title: 'Không có bài viết nào',
    no_posts_desc: 'Hãy sang tab "Xu hướng" và bấm "Tạo bài viết AI" để sinh nội dung tự động.',
    fb_post_title: 'Bài viết Facebook',
    comment_source_title: 'Bình luận nguồn',
    char_count: 'ký tự',
    read_more: 'Xem toàn bộ bài viết',
    read_more_comment: 'Xem toàn bộ bình luận',
    collapse: 'Thu gọn',
    collapse_comment: 'Thu gọn link',
    open_fb: 'Mở Facebook',
    screenshot: 'Ảnh chụp',
    btn_edit: 'Sửa',
    btn_cancel: 'Hủy',
    btn_save: 'Lưu',
    btn_save_changes: 'Lưu thay đổi',
    btn_comment: 'Bình luận',
    btn_delete: 'Xóa',
    confirm_delete: 'Xác nhận xóa',
    test_run: 'Chạy thử',
    publish_now: 'Đăng bài ngay',
    published_success_badge: 'Đã xuất bản trên Facebook',
    view_post_button: 'Xem bài đăng',
    error_prefix: 'Lỗi:',

    // Logs Tab
    log_level_all: 'Tất cả',
    log_action_all: 'Tất cả hành động',
    btn_clear_logs: 'Xóa nhật ký',
    no_logs_title: 'Chưa có nhật ký hoạt động',
    no_logs_desc: 'Các hoạt động cào tin, viết bài AI và tự động đăng sẽ được ghi nhận tại đây.',

    // Settings Tab
    settings_target_title: 'Chế độ xuất bản: Đăng lên Fanpage hoặc Trang cá nhân',
    settings_target_desc: 'Lựa chọn tư cách đăng bài Facebook và cấu hình Fanpage nhận bài tự động.',
    target_page_btn: 'Đăng lên Fanpage (Facebook Page)',
    target_page_desc: 'Tự động đăng bài và bình luận link nguồn dưới tư cách Trang / Fanpage bạn làm quản trị viên. Tối ưu thương hiệu & bảo vệ tài khoản cá nhân.',
    target_profile_btn: 'Đăng lên Trang cá nhân (Timeline)',
    target_profile_desc: 'Đăng trực tiếp lên tường trang cá nhân Facebook của nick đang đăng nhập. Phù hợp xây dựng thương hiệu cá nhân (KOL/KOC).',
    fanpage_url_label: 'Đường dẫn / URL Fanpage nhận bài',
    fanpage_name_label: 'Tên hiển thị Fanpage',
    settings_ai_title: 'Cấu hình Gemini AI & Tự động hóa',
    settings_ai_desc: 'Thiết lập API key và phong cách viết bài đăng cho bot.',
    gemini_key_label: 'Google Gemini API Key',
    gemini_key_placeholder: 'Nhập GEMINI_API_KEY (hoặc để trống để dùng mẫu thông minh tích hợp sẵn)...',
    gemini_key_desc: 'Dùng để tạo nội dung phân tích sâu sắc, phong cách hấp dẫn kèm icon và định dạng bài Facebook chuẩn SEO.',
    btn_hide: 'Ẩn',
    btn_show: 'Hiện',
    auto_mode_title: 'Chế độ Auto-Pilot hoàn toàn (Tự động đăng ngay không cần duyệt tay)',
    auto_mode_desc: 'Khi bật: bot cào Google Trends xong sẽ tự viết bài và đăng ngay lập tức. Khi tắt: bài viết sẽ nằm ở bản thảo để bạn xem & sửa trước khi bấm Đăng.',
    posts_per_cycle_title: 'Số lượng bài đăng mỗi lần chạy tự động (trendpulse-cron / Auto-cycle)',
    posts_per_cycle_desc: 'Số bài viết AI tự động cào và xuất bản trong mỗi chu kỳ. Khi chọn từ 2 bài trở lên, hệ thống sẽ tự động nghỉ 25 giây giữa các bài để bảo vệ tài khoản Facebook khỏi spam.',
    post_count_1: '1 bài / lần chạy',
    post_count_2: '2 bài / lần chạy',
    post_count_3: '3 bài / lần chạy',
    post_count_4: '4 bài / lần chạy',
    post_count_5: '5 bài / lần chạy',
    tone_label: 'Phong cách viết bài (AI Tone)',
    tone_finance: 'Phân tích Tài chính & Kinh tế Chuyên nghiệp',
    tone_breaking: 'Điểm tin Nhanh & Nóng hổi (Breaking)',
    tone_viral: 'Tương tác Cộng đồng & Thảo luận Sôi nổi',
    geo_label: 'Khu vực Google Trends mặc định',
    keywords_label: 'Từ khóa ưu tiên Tài chính / Kinh tế (Phân tách bởi dấu phẩy)',
    keywords_desc: 'Các xu hướng khớp với từ khóa này sẽ tự động được gắn thẻ Tài chính & ưu tiên xử lý trước.',
    btn_save_settings: 'Lưu tất cả cấu hình',
    settings_saved_alert: 'Đã lưu cấu hình thành công!',

    // PWA & Backup
    pwa_title: 'Cài đặt Ứng dụng Di động (PWA)',
    pwa_desc: 'Cài đặt TrendPulse lên màn hình chính điện thoại hoặc máy tính để dùng mượt như App gốc.',
    btn_install_pwa: 'Cài đặt Ứng dụng',
    pwa_ios_instruction: 'Mở Safari > Bấm nút Chia sẻ (Share 📤) ở thanh dưới > Chọn Thêm vào MH chính (Add to Home Screen).',
    pwa_android_instruction: 'Mở Chrome > Bấm menu 3 chấm (⋮) góc trên phải > Chọn Cài đặt ứng dụng hoặc Thêm vào màn hình chính.',
  },
  en: {
    // Header & Brand
    app_name: 'TrendPulse',
    app_badge: 'PWA • AI',
    connect_fb: 'Connect FB',
    connected: 'Connected',
    connecting: 'Connecting...',
    refresh_data: 'Refresh data',
    refresh_now: 'Refresh now',
    auto_refresh: 'Auto Refresh',
    refresh_off: 'Off',
    refresh_every: 'Every',
    refresh_15s: 'Every 15s',
    refresh_30s: 'Every 30s (Default)',
    refresh_60s: 'Every 1 min',
    refresh_120s: 'Every 2 mins',
    dry_run: 'Dry Run',
    run_auto: 'Auto Run',
    run: 'Run',
    running: 'Running...',
    logout: 'Log out',
    logout_confirm: 'Are you sure you want to log out?',
    logging_out: 'Logging out...',
    theme_dark: 'Dark Mode',
    theme_light: 'Light Mode',
    lang_switch: 'Language',

    // Navigation Tabs
    tab_overview: 'Overview',
    tab_trends: 'Trends',
    tab_posts: 'Posts',
    tab_logs: 'Logs',
    tab_settings: 'Settings',

    // Stats Cards
    stat_trends: 'Trends',
    stat_drafts: 'Drafts',
    stat_published: 'Published',
    stat_logs: 'Logs',

    // Overview Tab
    recent_published_title: 'Recently Published Posts',
    view_all: 'View all',
    no_published_posts: 'No published posts yet. Click "Auto Run" to start.',
    auto_comment_prefix: '💬 Auto-comment:',

    // Trends Tab
    search_trends_placeholder: 'Search trends...',
    region_all: '🌐 All Regions',
    crawl_btn: 'Crawl Trends',
    crawling: 'Crawling...',
    no_trends_title: 'No Trend Data',
    no_trends_desc: 'Click "Crawl Trends" to fetch the latest Business & Finance trends.',
    crawl_now: 'Crawl Now',
    traffic_label: 'Trending Searches',
    status_published: 'Published',
    status_drafted: 'Drafted',
    status_discovered: 'Discovered',
    source_links_count: 'source articles',
    find_sources_btn: 'Find Sources',
    searching_sources: 'Searching...',
    generate_post_btn: 'Generate AI Post',
    generating_post: 'Writing...',

    // Posts Tab
    filter_all: 'All',
    filter_draft: 'Drafts',
    filter_published: 'Published',
    filter_failed: 'Failed',
    filter_publishing: 'Publishing...',
    no_posts_title: 'No Posts Found',
    no_posts_desc: 'Go to "Trends" tab and click "Generate AI Post" to create content.',
    fb_post_title: 'Facebook Post',
    comment_source_title: 'Source Comment',
    char_count: 'chars',
    read_more: 'Read full post',
    read_more_comment: 'Read full comment',
    collapse: 'Collapse',
    collapse_comment: 'Collapse links',
    open_fb: 'Open Facebook',
    screenshot: 'Screenshot',
    btn_edit: 'Edit',
    btn_cancel: 'Cancel',
    btn_save: 'Save',
    btn_save_changes: 'Save changes',
    btn_comment: 'Comment',
    btn_delete: 'Delete',
    confirm_delete: 'Confirm delete',
    test_run: 'Dry Run',
    publish_now: 'Publish Now',
    published_success_badge: 'Published on Facebook',
    view_post_button: 'View Post',
    error_prefix: 'Error:',

    // Logs Tab
    log_level_all: 'All',
    log_action_all: 'All actions',
    btn_clear_logs: 'Clear Logs',
    no_logs_title: 'No Activity Logs Yet',
    no_logs_desc: 'Crawling, AI generation, and publishing events will appear here.',

    // Settings Tab
    settings_target_title: 'Publish Target: Fanpage or Personal Profile',
    settings_target_desc: 'Select Facebook destination mode and configure target Fanpage.',
    target_page_btn: 'Post to Fanpage (Facebook Page)',
    target_page_desc: 'Automatically publish posts and comments as Page Admin. Enhances brand authority & protects personal account.',
    target_profile_btn: 'Post to Personal Profile (Timeline)',
    target_profile_desc: 'Post directly to your personal Facebook timeline. Ideal for building personal influence (KOL/KOC).',
    fanpage_url_label: 'Target Fanpage URL',
    fanpage_name_label: 'Fanpage Display Name',
    settings_ai_title: 'Gemini AI & Automation Settings',
    settings_ai_desc: 'Configure Gemini API key and AI writing style.',
    gemini_key_label: 'Google Gemini API Key',
    gemini_key_placeholder: 'Enter GEMINI_API_KEY (or leave blank to use built-in smart prompt)...',
    gemini_key_desc: 'Used to craft deep analytical, engaging Facebook posts with SEO formatting and emojis.',
    btn_hide: 'Hide',
    btn_show: 'Show',
    auto_mode_title: 'Full Auto-Pilot Mode (Publish immediately without approval)',
    auto_mode_desc: 'When enabled: bot crawls, writes, and publishes immediately. When disabled: posts stay in drafts for review.',
    posts_per_cycle_title: 'Posts per automation cycle (trendpulse-cron / Auto-cycle)',
    posts_per_cycle_desc: 'Number of AI posts per automated cycle. When 2 or more, automatically pauses 25s between posts to prevent spam triggers.',
    post_count_1: '1 post / cycle',
    post_count_2: '2 posts / cycle',
    post_count_3: '3 posts / cycle',
    post_count_4: '4 posts / cycle',
    post_count_5: '5 posts / cycle',
    tone_label: 'AI Writing Tone',
    tone_finance: 'Professional Business & Finance Analysis',
    tone_breaking: 'Breaking & Fast News Updates',
    tone_viral: 'Community & Viral Discussion',
    geo_label: 'Default Google Trends Region',
    keywords_label: 'Priority Finance Keywords (comma-separated)',
    keywords_desc: 'Trends matching these keywords will be tagged as Finance & processed first.',
    btn_save_settings: 'Save All Settings',
    settings_saved_alert: 'Settings saved successfully!',

    // PWA & Backup
    pwa_title: 'Install Mobile App (PWA)',
    pwa_desc: 'Install TrendPulse on your phone home screen or desktop for a native app experience.',
    btn_install_pwa: 'Install App',
    pwa_ios_instruction: 'Open Safari > Tap the Share button (📤) at the bottom > Choose "Add to Home Screen".',
    pwa_android_instruction: 'Open Chrome > Tap the 3 dots menu (⋮) > Choose "Install app" or "Add to Home Screen".',
  },
};

export type TranslationKey = keyof typeof translations['vi'];

interface I18nThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  lang: Language;
  toggleLang: () => void;
  setLang: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

const I18nThemeContext = createContext<I18nThemeContextType>({
  theme: 'dark',
  toggleTheme: () => {},
  setTheme: () => {},
  lang: 'vi',
  toggleLang: () => {},
  setLang: () => {},
  t: (key) => translations.vi[key] || key,
});

export function I18nThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [lang, setLangState] = useState<Language>('vi');
  const [isMounted, setIsMounted] = useState(false);

  const applyTheme = (newTheme: Theme) => {
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      root.setAttribute('data-theme', newTheme);
      root.style.colorScheme = newTheme;
      if (newTheme === 'light') {
        root.classList.add('light');
        root.classList.remove('dark');
      } else {
        root.classList.add('dark');
        root.classList.remove('light');
      }
    }
  };

  useEffect(() => {
    setIsMounted(true);
    // Load theme from localStorage
    const savedTheme = localStorage.getItem('trendpulse_theme') as Theme | null;
    if (savedTheme === 'light' || savedTheme === 'dark') {
      setThemeState(savedTheme);
      applyTheme(savedTheme);
    } else {
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const initialTheme = prefersDark ? 'dark' : 'dark'; // default dark
      setThemeState(initialTheme);
      applyTheme(initialTheme);
    }

    // Load lang from localStorage
    const savedLang = localStorage.getItem('trendpulse_lang') as Language | null;
    if (savedLang === 'vi' || savedLang === 'en') {
      setLangState(savedLang);
    }
  }, []);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('trendpulse_theme', newTheme);
    applyTheme(newTheme);
  };

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
  };

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem('trendpulse_lang', newLang);
    if (typeof document !== 'undefined') {
      document.documentElement.lang = newLang;
    }
  };

  const toggleLang = () => {
    const nextLang = lang === 'vi' ? 'en' : 'vi';
    setLang(nextLang);
  };

  const t = (key: TranslationKey): string => {
    const currentDict = translations[lang] || translations.vi;
    return currentDict[key] || translations.vi[key] || key;
  };

  return (
    <I18nThemeContext.Provider
      value={{
        theme,
        toggleTheme,
        setTheme,
        lang,
        toggleLang,
        setLang,
        t,
      }}
    >
      <AstryxTheme theme={themes[defaultThemeSlug]} mode={theme}>
        {children}
      </AstryxTheme>
    </I18nThemeContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nThemeContext);
}
