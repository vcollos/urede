-- Seed de desenvolvimento: cooperativas e cidades mínimas
-- Seguro para rodar várias vezes (ignora duplicadas)

-- Cooperativas
INSERT INTO public.cooperativas (
  id_singular, uniodonto, cnpj, cro_operadora, data_fundacao, raz_social,
  codigo_ans, federacao, software, tipo, op_pr
) VALUES
  ('801','FEDERAÇÃO RS','72.120.124/0001-11','1100 RS', to_date('29/11/1991','DD/MM/YYYY'),'UNIODONTO RS FEDERAÇÃO DAS UNIODONTOS DO RS LTDA.','305421','BRASIL','OBJETIVA','FEDERAÇÃO','Operadora'),
  ('800','FEDERAÇÃO MINAS','01.182.248/0001-83','EPAO-1089', to_date('15/01/1996','DD/MM/YYYY'),'FEDERAÇÃO DAS UNIODONTOS DO ESTADO DE MINAS GERAIS','344583','BRASIL','ODONTOSFERA','FEDERAÇÃO','Operadora'),
  ('805','FEDERAÇÃO AMAZÔNIA DO BRASIL','32.085.871/0001-41','', to_date('10/08/2018','DD/MM/YYYY'),'FEDERAÇÃO DAS COOPERATIVAS UNIODONTO DA AMAZÔNIA DO BRASIL','','BRASIL','','FEDERAÇÃO','Institucional'),
  ('010','UNIODONTO SP CAPITAL','60.196.097/0001-14','SP CD-230', to_date('12/03/1985','DD/MM/YYYY'),'COOPERATIVA DE TRABALHO ODONTOLÓGICO DE SÃO PAULO','305642','BRASIL','ODONTOSYSTEM','SINGULAR','Operadora'),
  ('015','UNIODONTO RIO','42.465.418/0001-67','RJ-147', to_date('18/07/1987','DD/MM/YYYY'),'COOPERATIVA DE TRABALHO ODONTOLÓGICO DO RIO DE JANEIRO','305758','BRASIL','DENTAL CLINIC','SINGULAR','Operadora'),
  ('020','UNIODONTO GOIÁS','01.355.442/0001-89','GO-089', to_date('05/11/1989','DD/MM/YYYY'),'COOPERATIVA DE TRABALHO ODONTOLÓGICO DE GOIÁS','305891','BRASIL','GESTÃO ODONTO','SINGULAR','Operadora')
ON CONFLICT (id_singular) DO NOTHING;

-- Cidades
INSERT INTO public.cidades (
  cd_municipio_7, cd_municipio, regional_saude, nm_cidade, uf_municipio,
  nm_regiao, cidades_habitantes, id_singular
) VALUES
  ('5200050','520005','Central','Abadia de Goiás','GO','Centro-Oeste',9158,'020'),
  ('3100104','310010','Uberlândia','Abadia dos Dourados','MG','Sudeste',7022,'015'),
  ('5200100','520010','Pirineus','Abadiânia','GO','Centro-Oeste',20873,'020'),
  ('3500105','350010','São Paulo Capital','São Paulo','SP','Sudeste',12396372,'010'),
  ('3304557','330455','Metropolitana I','Rio de Janeiro','RJ','Sudeste',6747815,'015')
ON CONFLICT (cd_municipio_7) DO NOTHING;
