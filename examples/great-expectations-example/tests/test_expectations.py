import great_expectations as gx
import pandas as pd
from great_expectations.expectations import (
    ExpectColumnValuesToBeBetween,
    ExpectColumnValuesToBeInSet,
    ExpectColumnValuesToBeUnique,
)


def _batch_from_records(records: dict):
    context = gx.get_context(mode='ephemeral')
    data_source = context.data_sources.add_pandas(name='pandas_ds')
    data_asset = data_source.add_dataframe_asset(name='df_asset')

    batch_definition = data_asset.add_batch_definition_whole_dataframe('whole_df')
    return batch_definition.get_batch(batch_parameters={'dataframe': pd.DataFrame(records)})


def test_orders_amount_is_between_range():
    batch = _batch_from_records(
        {
            "order_id": [1001, 1002, 1003, 1004],
            "amount": [15.5, 42.0, 8.25, 99.99],
            "country": ["US", "DE", "US", "FR"],
        }
    )

    result = batch.validate(ExpectColumnValuesToBeBetween(column="amount", min_value=0, max_value=100))

    assert result.success


def test_country_values_are_in_expected_set():
    batch = _batch_from_records(
        {
            "order_id": [2001, 2002, 2003],
            "country": ["US", "DE", "FR"],
        }
    )

    result = batch.validate(ExpectColumnValuesToBeInSet(column="country", value_set=["US", "DE", "FR", "GB"]))

    assert result.success


def test_order_id_is_unique():
    batch = _batch_from_records(
        {
            "order_id": [3001, 3002, 3003, 3004],
            "amount": [1, 2, 3, 4],
        }
    )

    result = batch.validate(ExpectColumnValuesToBeUnique(column="order_id"))

    assert result.success
