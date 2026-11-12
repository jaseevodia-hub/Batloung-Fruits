-- Fruit type descriptions.
-- Safe to run more than once. Only the description column is changed.

UPDATE fruits
SET description = 'Crisp, juicy apples supplied in bulk boxes, suitable for resale, fresh eating and juice.'
WHERE fruit_name = 'Apples';

UPDATE fruits
SET description = 'Naturally sweet ripe bananas, sold by the box and popular with street vendors.'
WHERE fruit_name = 'Bananas';

UPDATE fruits
SET description = 'Fresh citrus oranges with sweet juice, ideal for resale and fresh juice stalls.'
WHERE fruit_name = 'Oranges';

UPDATE fruits
SET description = 'Sweet, plump grapes packed in boxes for resale and catering.'
WHERE fruit_name = 'Grapes';

UPDATE fruits
SET description = 'Ripe seasonal mangoes with sweet golden flesh, supplied in bulk boxes.'
WHERE fruit_name = 'Mangoes';
