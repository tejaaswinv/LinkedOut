export const companies = [
  {
    slug: 'amazon', name: 'Amazon', logo: 'a', sector: 'E-commerce & Cloud', location: 'Seattle, WA', score: 2.6,
    reviews: 23400, employees: 18700, rank: 'Bottom 24%', trend: -0.2,
    metrics: { 'Work-Life Balance': 2.1, Management: 2.3, 'Office Politics': 1.9, Compensation: 3.1 },
    issues: ['Burnout','Unrealistic Targets','Micromanagement','High Turnover','Poor Communication'],
    summary: 'Employees frequently mention intense performance pressure, long hours, and manager-dependent experiences. Learning opportunities are strong, but many reviewers say career growth can come at the cost of personal time.'
  },
  {
    slug: 'microsoft', name: 'Microsoft', logo: '⊞', sector: 'Technology', location: 'Redmond, WA', score: 2.8,
    reviews: 15200, employees: 12200, rank: 'Bottom 31%', trend: -0.1,
    metrics: { 'Work-Life Balance': 3.2, Management: 2.6, 'Office Politics': 2.2, Compensation: 3.6 },
    issues: ['Reorgs','Manager Variance','Promotion Politics','Meetings'],
    summary: 'Reviewers praise flexibility and compensation, while recurring concerns focus on reorg fatigue, slow decision-making, and inconsistent management quality across teams.'
  },
  {
    slug: 'meta', name: 'Meta', logo: '∞', sector: 'Technology', location: 'Menlo Park, CA', score: 2.4,
    reviews: 9800, employees: 7200, rank: 'Bottom 18%', trend: -0.3,
    metrics: { 'Work-Life Balance': 2.4, Management: 2.2, 'Office Politics': 2.0, Compensation: 4.2 },
    issues: ['Performance Pressure','Layoff Anxiety','Politics','Burnout'],
    summary: 'High compensation and ambitious projects are common positives. Negative reviews often mention performance pressure, shifting priorities, and anxiety around reorganizations.'
  },
  {
    slug: 'deloitte', name: 'Deloitte', logo: 'D.', sector: 'Consulting', location: 'Global', score: 3.2,
    reviews: 6700, employees: 5300, rank: 'Mid-pack', trend: 0.1,
    metrics: { 'Work-Life Balance': 2.6, Management: 3.0, 'Office Politics': 2.8, Compensation: 3.0 },
    issues: ['Long Hours','Staffing','Promotion Cycles','Client Pressure'],
    summary: 'Reviewers value strong brand recognition and exposure to varied clients. The most common frustrations are long hours, staffing volatility, and promotion processes that can feel political.'
  },
  {
    slug: 'tesla', name: 'Tesla', logo: 'T', sector: 'Automotive & Energy', location: 'Austin, TX', score: 2.7,
    reviews: 5200, employees: 3900, rank: 'Bottom 29%', trend: -0.2,
    metrics: { 'Work-Life Balance': 1.9, Management: 2.5, 'Office Politics': 2.4, Compensation: 3.2 },
    issues: ['Overtime','Urgency Culture','Turnover','Leadership'],
    summary: 'Employees often describe fast learning and high ownership alongside relentless urgency, long working hours, and frequent organizational changes.'
  },
  {
    slug: 'google', name: 'Google', logo: 'G', sector: 'Technology', location: 'Mountain View, CA', score: 3.4,
    reviews: 12100, employees: 10100, rank: 'Top 46%', trend: 0.0,
    metrics: { 'Work-Life Balance': 3.6, Management: 3.0, 'Office Politics': 2.7, Compensation: 4.1 },
    issues: ['Promotion Process','Bureaucracy','Reorgs','Visibility'],
    summary: 'Strong compensation, benefits, and technical peers are frequently praised. Common concerns center on bureaucracy, promotion calibration, and navigating large-company politics.'
  },
  {
    slug: 'jpmorgan', name: 'JPMorganChase', logo: 'J', sector: 'Banking', location: 'New York, NY', score: 3.0,
    reviews: 8900, employees: 7600, rank: 'Mid-pack', trend: 0.1,
    metrics: { 'Work-Life Balance': 2.7, Management: 2.9, 'Office Politics': 2.8, Compensation: 3.5 },
    issues: ['Hierarchy','Long Hours','Promotion Politics','Legacy Systems'],
    summary: 'Reviewers cite strong brand value and career mobility, but describe a hierarchical environment where work-life balance varies heavily by desk and manager.'
  },
  {
    slug: 'dbs', name: 'DBS Bank', logo: 'DBS', sector: 'Banking', location: 'Singapore', score: 3.5,
    reviews: 4100, employees: 3400, rank: 'Top 38%', trend: 0.1,
    metrics: { 'Work-Life Balance': 3.3, Management: 3.2, 'Office Politics': 2.9, Compensation: 3.4 },
    issues: ['Process','Meeting Load','Manager Variance','Transformation Fatigue'],
    summary: 'Employees frequently praise stability and digital transformation opportunities. Concerns include process overhead, meeting load, and uneven management quality across teams.'
  }
];

export const seedReviews = [
  { id: 1, user: '@overitdev', verified: true, company: 'Amazon', companySlug: 'amazon', role: 'Software Engineer', tenure: '2y', location: 'Seattle, WA', time: '2h', body: 'Constantly firefighting while leadership chases the next big thing. On-call rotations destroy any chance of a normal life. People are smart, but the system is broken.', tags: ['Unpaid OT','Burnout','Poor Management'], votes: 128, comments: 32 },
  { id: 2, user: '@data_driven', verified: true, company: 'Amazon', companySlug: 'amazon', role: 'Data Analyst', tenure: '1.5y', location: 'Seattle, WA', time: '5h', body: 'Great learning early on, but expect to be treated like a number. Promotions feel random and based more on visibility than impact.', tags: ['Promotion Politics','Burnout'], votes: 96, comments: 18 },
  { id: 3, user: '@deck_slave', verified: true, company: 'Deloitte', companySlug: 'deloitte', role: 'Consultant', tenure: '3y', location: 'Singapore', time: '8h', body: 'The team can be amazing, but staffing is a lottery. One project gives you balance; the next turns every evening into a client emergency.', tags: ['Long Hours','Client Pressure'], votes: 203, comments: 41 },
  { id: 4, user: '@reorg_survivor', verified: true, company: 'Microsoft', companySlug: 'microsoft', role: 'Program Manager', tenure: '4y', location: 'Redmond, WA', time: '1d', body: 'Solid benefits and smart colleagues. The exhausting part is relearning the org chart every few months and rebuilding visibility after each reorg.', tags: ['Reorgs','Office Politics'], votes: 176, comments: 27 }
];

export const profile = {
  username: '@burntoutbanker',
  status: 'Verified Employee',
  employer: 'Global Finance Co.',
  role: 'Senior Analyst',
  location: 'New York, NY'
};

export function getCompany(slug) {
  return companies.find(c => c.slug === slug);
}
