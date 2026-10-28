export interface NewsArticle {
  title: string;
  snippet: string;
  url: string;
  source: string;
}

export interface TrendItem {
  id: string;
  title: string;
  geo: string;
  approx_traffic: string;
  pub_date: string;
  articles: NewsArticle[];
  articles_json?: string;
  category: string;
  status: 'discovered' | 'drafted' | 'published' | 'ignored';
  created_at?: string;
}

export interface PostItem {
  id: string;
  trend_id?: string | null;
  trend_title: string;
  post_content: string;
  comment_content: string;
  source_urls: string[];
  status: 'draft' | 'queued' | 'publishing' | 'published' | 'failed';
  fb_post_url?: string | null;
  fb_post_id?: string | null;
  comment_id?: string | null;
  error_message?: string | null;
  screenshot_path?: string | null;
  scheduled_at?: string | null;
  published_at?: string | null;
  created_at?: string;
}

export interface ActivityLog {
  id: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS';
  action: string;
  message: string;
  details_json?: string | null;
  created_at: string;
}
