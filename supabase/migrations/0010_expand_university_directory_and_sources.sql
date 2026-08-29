alter table public.universities add column if not exists source text not null default 'seed';

insert into public.universities (slug,name,domain,domains,website,city,country,source) values
('duke-nus-medical-school','Duke-NUS Medical School','duke-nus.edu.sg',array['duke-nus.edu.sg'],'https://www.duke-nus.edu.sg','Singapore','Singapore','seed'),
('university-of-the-arts-singapore','University of the Arts Singapore','uas.edu.sg',array['uas.edu.sg'],'https://www.uas.edu.sg','Singapore','Singapore','seed'),
('indian-institute-of-science','Indian Institute of Science','iisc.ac.in',array['iisc.ac.in'],'https://iisc.ac.in','Bengaluru','India','seed'),
('indian-institute-of-technology-kanpur','Indian Institute of Technology Kanpur','iitk.ac.in',array['iitk.ac.in'],'https://www.iitk.ac.in','Kanpur','India','seed'),
('indian-institute-of-technology-kharagpur','Indian Institute of Technology Kharagpur','iitkgp.ac.in',array['iitkgp.ac.in'],'https://www.iitkgp.ac.in','Kharagpur','India','seed'),
('indian-institute-of-technology-roorkee','Indian Institute of Technology Roorkee','iitr.ac.in',array['iitr.ac.in'],'https://www.iitr.ac.in','Roorkee','India','seed'),
('indian-institute-of-technology-guwahati','Indian Institute of Technology Guwahati','iitg.ac.in',array['iitg.ac.in'],'https://www.iitg.ac.in','Guwahati','India','seed'),
('indian-institute-of-technology-hyderabad','Indian Institute of Technology Hyderabad','iith.ac.in',array['iith.ac.in'],'https://www.iith.ac.in','Hyderabad','India','seed'),
('international-institute-of-information-technology-hyderabad','International Institute of Information Technology Hyderabad','iiit.ac.in',array['iiit.ac.in'],'https://www.iiit.ac.in','Hyderabad','India','seed'),
('international-institute-of-information-technology-bangalore','International Institute of Information Technology Bangalore','iiitb.ac.in',array['iiitb.ac.in'],'https://www.iiitb.ac.in','Bengaluru','India','seed'),
('national-institute-of-technology-tiruchirappalli','National Institute of Technology Tiruchirappalli','nitt.edu',array['nitt.edu'],'https://www.nitt.edu','Tiruchirappalli','India','seed'),
('anna-university','Anna University','annauniv.edu',array['annauniv.edu'],'https://www.annauniv.edu','Chennai','India','seed'),
('vellore-institute-of-technology','Vellore Institute of Technology','vit.ac.in',array['vit.ac.in'],'https://vit.ac.in','Vellore','India','seed'),
('srm-institute-of-science-and-technology','SRM Institute of Science and Technology','srmist.edu.in',array['srmist.edu.in'],'https://www.srmist.edu.in','Chennai','India','seed'),
('manipal-academy-of-higher-education','Manipal Academy of Higher Education','manipal.edu',array['manipal.edu'],'https://www.manipal.edu','Manipal','India','seed'),
('university-of-delhi','University of Delhi','du.ac.in',array['du.ac.in'],'https://www.du.ac.in','Delhi','India','seed'),
('jadavpur-university','Jadavpur University','jaduniv.edu.in',array['jaduniv.edu.in'],'https://jaduniv.edu.in','Kolkata','India','seed'),
('ashoka-university','Ashoka University','ashoka.edu.in',array['ashoka.edu.in'],'https://www.ashoka.edu.in','Sonipat','India','seed'),
('amrita-vishwa-vidyapeetham','Amrita Vishwa Vidyapeetham','amrita.edu',array['amrita.edu'],'https://www.amrita.edu','Coimbatore','India','seed')
on conflict (slug) do update set
  name=excluded.name,
  domain=excluded.domain,
  domains=excluded.domains,
  website=excluded.website,
  city=excluded.city,
  country=excluded.country,
  updated_at=now();
