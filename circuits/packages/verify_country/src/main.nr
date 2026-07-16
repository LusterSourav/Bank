fn main(country_code: Field, pub expected_code: Field) -> pub Field {
    assert(country_code == expected_code);
    1
}
