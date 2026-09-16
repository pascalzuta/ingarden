export type TeamMember = {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'member';
  user_id: string | null;
  created_at: string;
};

export type InfluencerStatus = 'prospect' | 'contacted' | 'negotiating' | 'active' | 'paused' | 'ended';

export type Influencer = {
  id: string;
  name: string;
  instagram_handle: string;
  email: string;
  phone: string;
  manager_contact: string;
  address: string;
  status: InfluencerStatus;
  tags: string[];
  follower_count: number | null;
  median_story_views: number | null;
  median_reel_views: number | null;
  story_rate_cents: number | null;
  reel_rate_cents: number | null;
  currency: string;
  discount_code: string;
  notes: string;
  owner_member_id: string | null;
  created_at: string;
  updated_at: string;
};

export type PostFormat = 'reel' | 'story' | 'feed' | 'other';
export type PostStatus = 'planned' | 'agreed' | 'content_review' | 'scheduled' | 'posted' | 'canceled';

export type Post = {
  id: string;
  influencer_id: string;
  title: string;
  format: PostFormat;
  status: PostStatus;
  scheduled_at: string | null;
  posted_at: string | null;
  fee_cents: number;
  gifting_cost_cents: number;
  currency: string;
  discount_code: string;
  link_id: string | null;
  post_url: string;
  views: number | null;
  likes: number | null;
  comments_count: number | null;
  saves: number | null;
  reach: number | null;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type TrackedLink = {
  id: string;
  slug: string;
  destination_url: string;
  influencer_id: string | null;
  active: boolean;
  created_at: string;
};

export type Conversion = {
  id: string;
  occurred_at: string;
  discount_code: string;
  revenue_cents: number;
  currency: string;
  order_ref: string;
  source: 'code' | 'link' | 'manual' | 'import';
  influencer_id: string | null;
  post_id: string | null;
  created_at: string;
};

export type AttributedConversion = Omit<Conversion, 'created_at'>;

export type Interaction = {
  id: string;
  influencer_id: string;
  kind: 'note' | 'email' | 'dm' | 'call' | 'meeting' | 'status_change';
  direction: 'in' | 'out' | null;
  body: string;
  occurred_at: string;
  member_id: string | null;
  created_at: string;
};

export type LinkClick = {
  id: string;
  link_id: string;
  clicked_at: string;
  referrer: string;
  user_agent: string;
};

export const POST_STATUS_LABELS: Record<PostStatus, string> = {
  planned: 'Planned',
  agreed: 'Agreed',
  content_review: 'Content review',
  scheduled: 'Scheduled',
  posted: 'Posted',
  canceled: 'Canceled',
};

export const INFLUENCER_STATUS_LABELS: Record<InfluencerStatus, string> = {
  prospect: 'Prospect',
  contacted: 'Contacted',
  negotiating: 'Negotiating',
  active: 'Active',
  paused: 'Paused',
  ended: 'Ended',
};
