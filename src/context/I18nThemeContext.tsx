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
    tab_reels: 'Reels',
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
    find_sources_and_publish_btn: 'Tìm nguồn & Đăng ngay',
    retrying_sources_and_publish: 'Đang tìm nguồn & đăng...',
    batch_retry_btn: 'Chạy lại tìm nguồn & Đăng bài',
    batch_retrying: 'Đang quét & đăng...',
    missing_sources_badge: 'Chưa có nguồn',
    not_published_hint: 'Chưa đăng Fanpage',
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
    view_reel_button: 'Xem Reel',
    error_prefix: 'Lỗi:',
    delete_all_failed: 'Xóa tất cả bài lỗi',
    delete_all_failed_confirm: 'Xóa tất cả bài lỗi?',
    delete_all_btn: 'Xóa hết',

    // Reels Tab
    add_reel_btn: 'Thêm Reel mới',
    upload_video: 'Tải video lên',
    or_local_path: 'Hoặc nhập đường dẫn file video trên máy',
    reel_caption_label: 'Nội dung / Caption cho Reel',
    reel_caption_placeholder: 'Nhập nội dung mô tả, hashtag cho video Reel...',
    schedule_reel_toggle: 'Đặt lịch đăng tự động',
    schedule_time_label: 'Thời gian đăng dự kiến',
    filter_scheduled: 'Đã lên lịch',
    publish_reel_now: 'Đăng Reel ngay',
    save_as_draft: 'Lưu bản thảo',
    schedule_submit: 'Lên lịch đăng',
    no_reels_title: 'Chưa có video Reel nào',
    no_reels_desc: 'Bấm nút "Thêm Reel mới" để tải video hoặc nhập đường dẫn và đặt lịch chạy tự động.',
    scheduled_at_badge: 'Hẹn đăng:',
    check_scheduled_btn: 'Kiểm tra lịch chạy',
    edit_reel_title: 'Chỉnh sửa / Đặt lại lịch Reel',
    cancel_schedule: 'Hủy lịch',
    delete_reel_confirm: 'Bạn có chắc chắn muốn xóa Reel này?',
    checking_schedule: 'Đang kiểm tra...',
    check_schedule_tooltip: 'Kiểm tra ngay xem có Reel nào đã đến giờ hẹn đăng không',
    filter_publishing_reel: 'Đang đăng',
    reel_status_published: 'Đã đăng Facebook',
    reel_status_scheduled: 'Hẹn giờ đăng',
    reel_status_draft: 'Bản thảo',
    reel_status_publishing: 'Đang đăng...',
    reel_status_failed: 'Thất bại',
    schedule_run_at: 'Lịch chạy:',
    reel_due_now: 'Đến giờ hẹn',
    click_to_preview_video: 'Bấm để xem thử video',
    preview_video: 'Xem trước video',
    read_more_caption: 'Xem thêm',
    collapse_caption: 'Thu gọn',
    no_caption_content: '(Không có nội dung caption)',
    btn_republish: 'Đăng lại',
    btn_publish_immediate: 'Đăng ngay',
    btn_reschedule: 'Đổi lịch',
    publish_reel_tooltip: 'Chạy Playwright Chromium tự động đăng video Reel lên Facebook ngay lập tức',
    edit_reel_tooltip: 'Sửa caption hoặc đặt lại lịch đăng',
    delete_reel_tooltip: 'Xóa Reel',
    deleting: 'Đang xóa...',
    saving: 'Đang lưu...',
    publishing_progress: 'Đang xuất bản...',
    reel_video_source: 'Nguồn Video Reel',
    upload_from_device: 'Tải video từ máy',
    local_file_path: 'Đường dẫn file trên máy',
    uploading_video_to_server: 'Đang tải video lên máy chủ...',
    click_or_drag_video: 'Bấm hoặc kéo thả video vào đây',
    click_to_change_file: 'Bấm để chọn file khác',
    supported_video_formats: 'Hỗ trợ định dạng MP4, MOV, WebM (tối ưu tỷ lệ dọc 9:16)',
    local_file_placeholder: 'Ví dụ: /Users/hungnt/Downloads/my-video.mp4 hoặc storage/videos/reel.mp4',
    local_file_tip: '💡 Bạn có thể kéo thả file video từ Finder vào ô này để tự điền đường dẫn.',
    suggested_hashtags: 'Hashtag gợi ý:',
    schedule_reel_desc: 'Hẹn giờ để bot tự động mở Playwright và xuất bản Reel khi đến hạn',
    will_publish_at: 'Sẽ đăng lúc:',
    no_reels_status_prefix: 'Không có Reel nào ở trạng thái',
    alert_upload_select_first: 'Vui lòng chọn và tải file video lên trước.',
    alert_local_path_required: 'Vui lòng nhập đường dẫn file video trên máy.',
    alert_upload_failed: 'Lỗi tải video lên',
    alert_create_failed: 'Lỗi tạo Reel',
    alert_update_failed: 'Lỗi cập nhật Reel',
    alert_check_scheduled_failed: 'Lỗi kiểm tra lịch chạy',
    alert_all_scheduled_pending: 'Tất cả Reel đã đặt lịch chưa đến giờ hẹn chạy.',
    alert_scheduled_processed: 'Đã phát hiện và xử lý {count} Reel theo lịch! (Thành công: {success}, Thất bại: {failed})',
    debug_video: 'Video quá trình lỗi',
    debug_video_title: 'Video quay lại quá trình đăng Reel lỗi (Playwright)',
    debug_screenshot_title: 'Ảnh chụp màn hình lỗi Playwright',
    download_video: 'Tải video',

    // Logs Tab
    log_level_all: 'Tất cả',
    log_action_all: 'Tất cả hành động',
    btn_clear_logs: 'Xóa nhật ký',
    no_logs_title: 'Chưa có nhật ký hoạt động',
    no_logs_desc: 'Các hoạt động cào tin, viết bài AI và tự động đăng sẽ được ghi nhận tại đây.',

    // Settings Tab
    settings_target_title: 'Cấu hình Fanpage Facebook',
    settings_target_desc: 'Nhập đường dẫn Fanpage và mở trình duyệt để lưu phiên đăng nhập tự động xuất bản bài viết.',
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
    tab_reels: 'Reels',
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
    find_sources_and_publish_btn: 'Find Sources & Post',
    retrying_sources_and_publish: 'Finding sources & posting...',
    batch_retry_btn: 'Find Sources & Post All',
    batch_retrying: 'Scanning & posting...',
    missing_sources_badge: 'Missing Sources',
    not_published_hint: 'Not Published to Page',
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
    view_reel_button: 'View Reel',
    error_prefix: 'Error:',
    delete_all_failed: 'Delete all failed',
    delete_all_failed_confirm: 'Delete all failed posts?',
    delete_all_btn: 'Delete all',

    // Reels Tab
    add_reel_btn: 'Add New Reel',
    upload_video: 'Upload Video',
    or_local_path: 'Or enter local video file path',
    reel_caption_label: 'Reel Caption / Description',
    reel_caption_placeholder: 'Enter caption, hashtags for your Facebook Reel...',
    schedule_reel_toggle: 'Schedule automatic publishing',
    schedule_time_label: 'Scheduled publishing time',
    filter_scheduled: 'Scheduled',
    publish_reel_now: 'Publish Reel Now',
    save_as_draft: 'Save Draft',
    schedule_submit: 'Schedule Reel',
    no_reels_title: 'No Reels Yet',
    no_reels_desc: 'Click "Add New Reel" to upload a video or enter a file path and schedule automatic publishing.',
    scheduled_at_badge: 'Scheduled for:',
    check_scheduled_btn: 'Check Schedule',
    edit_reel_title: 'Edit / Reschedule Reel',
    cancel_schedule: 'Cancel Schedule',
    delete_reel_confirm: 'Are you sure you want to delete this Reel?',
    checking_schedule: 'Checking...',
    check_schedule_tooltip: 'Check now if any scheduled Reels are due for publishing',
    filter_publishing_reel: 'Publishing',
    reel_status_published: 'Published to Facebook',
    reel_status_scheduled: 'Scheduled',
    reel_status_draft: 'Draft',
    reel_status_publishing: 'Publishing...',
    reel_status_failed: 'Failed',
    schedule_run_at: 'Schedule:',
    reel_due_now: 'Due now',
    click_to_preview_video: 'Click to preview video',
    preview_video: 'Preview video',
    read_more_caption: 'Show more',
    collapse_caption: 'Collapse',
    no_caption_content: '(No caption content)',
    btn_republish: 'Republish',
    btn_publish_immediate: 'Publish now',
    btn_reschedule: 'Reschedule',
    publish_reel_tooltip: 'Run Playwright Chromium to publish video Reel to Facebook immediately',
    edit_reel_tooltip: 'Edit caption or reschedule publishing',
    delete_reel_tooltip: 'Delete Reel',
    deleting: 'Deleting...',
    saving: 'Saving...',
    publishing_progress: 'Publishing...',
    reel_video_source: 'Reel Video Source',
    upload_from_device: 'Upload from device',
    local_file_path: 'Local file path',
    uploading_video_to_server: 'Uploading video to server...',
    click_or_drag_video: 'Click or drag & drop video here',
    click_to_change_file: 'Click to select another file',
    supported_video_formats: 'Supports MP4, MOV, WebM (vertical 9:16 ratio recommended)',
    local_file_placeholder: 'Example: /Users/username/Downloads/my-video.mp4 or storage/videos/reel.mp4',
    local_file_tip: '💡 You can drag and drop a video file from Explorer/Finder here to auto-fill.',
    suggested_hashtags: 'Suggested hashtags:',
    schedule_reel_desc: 'Set a time for bot to automatically open Playwright and publish Reel when due',
    will_publish_at: 'Will publish at:',
    no_reels_status_prefix: 'No Reels with status',
    alert_upload_select_first: 'Please select and upload a video file first.',
    alert_local_path_required: 'Please enter a local video file path.',
    alert_upload_failed: 'Video upload failed',
    alert_create_failed: 'Failed to create Reel',
    alert_update_failed: 'Failed to update Reel',
    alert_check_scheduled_failed: 'Failed to check scheduled Reels',
    alert_all_scheduled_pending: 'All scheduled Reels have not reached their scheduled time yet.',
    alert_scheduled_processed: 'Detected and processed {count} scheduled Reels! (Success: {success}, Failed: {failed})',
    debug_video: 'Debug Video',
    debug_video_title: 'Playwright Error Recording Video',
    debug_screenshot_title: 'Playwright Error Screenshot',
    download_video: 'Download Video',

    // Logs Tab
    log_level_all: 'All',
    log_action_all: 'All actions',
    btn_clear_logs: 'Clear Logs',
    no_logs_title: 'No Activity Logs Yet',
    no_logs_desc: 'Crawling, AI generation, and publishing events will appear here.',

    // Settings Tab
    settings_target_title: 'Facebook Fanpage Configuration',
    settings_target_desc: 'Configure Fanpage URL and open browser to manage login session for automated publishing.',
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
